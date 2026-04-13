import os
import cv2
import time
import threading
import json
import torch
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort
import numpy as np

app = Flask(__name__)
CORS(app)

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Global state
processing_active = False
uploaded_media_type = None
processing_session_id = 0
current_stats = {
    "peopleCount": 0,
    "instantCount": 0,
    "uniqueCount": 0,
    "harmfulObjectCount": 0,
    "harmfulObjectLabels": [],
    "frameVersion": 0,
    "threshold": 50,
    "riskLevel": "safe",
    "counting": False,
    "mediaType": None,
    "processingSeconds": 0,
    "countMode": "head+grid-density",
    "gridRows": 6,
    "gridCols": 8,
    "occupiedCells": 0,
    "occupancyRatio": 0.0,
    "estimatedCapacity": 96,
    "densityEstimate": 0,
    "harmfulDetectionEnabled": True,
    "fireDetected": False,
    "fireConfidence": 0.0,
    "videoOpenError": "",
    "timestamp": time.strftime("%H:%M:%S"),
    "trendData": [],
    "logs": [],
    "alerts": []
}

latest_frame = None
lock = threading.Lock()
GRID_ROWS = 6
GRID_COLS = 8
PEOPLE_PER_CELL = 2
HARMFUL_DETECTION_ENABLED = True

# Use pretrained COCO models:
# - Keep image model as-is (already accurate per user feedback)
# - Use a stronger model for video to improve recall on small/far people
IMAGE_MODEL_PATH = 'yolov8n.pt'
VIDEO_MODEL_PATH = 'yolov8s.pt'

image_model = YOLO(IMAGE_MODEL_PATH)
video_model = None
VIDEO_PERSON_CLASS_IDS = []

# ✅ GPU active - ENABLED for high-sensitivity processing
if torch.cuda.is_available():
     image_model.to("cuda")

def get_person_class_ids(m):
    try:
        names = m.names if hasattr(m, "names") else {}
        if isinstance(names, list):
            names = {idx: name for idx, name in enumerate(names)}
        elif not isinstance(names, dict):
            names = {}
        person_ids = []
        for class_id, class_name in names.items():
            lowered = str(class_name).strip().lower()
            if lowered in ("person", "people", "human", "man", "woman", "pedestrian"):
                person_ids.append(int(class_id))
        return person_ids
    except Exception:
        return []

IMAGE_PERSON_CLASS_IDS = get_person_class_ids(image_model)
# Harmful object classes (COCO-style labels) to detect alongside people.
HARMFUL_CLASS_NAMES = {
    "knife", "scissors", "baseball bat", "gun", "pistol", "rifle", "firearm"
}
VIDEO_HARMFUL_CLASS_IDS = []

def get_video_model():
    global video_model, VIDEO_PERSON_CLASS_IDS, VIDEO_HARMFUL_CLASS_IDS
    if video_model is None:
        m = YOLO(VIDEO_MODEL_PATH)
        if torch.cuda.is_available():
            m.to("cuda")
        video_model = m
        VIDEO_PERSON_CLASS_IDS = get_person_class_ids(video_model)
        try:
            names = video_model.names if isinstance(video_model.names, dict) else {}
            VIDEO_HARMFUL_CLASS_IDS = [
                int(class_id)
                for class_id, class_name in names.items()
                if str(class_name).strip().lower() in HARMFUL_CLASS_NAMES
            ]
        except Exception:
            VIDEO_HARMFUL_CLASS_IDS = []
    return video_model

def get_risk_level(count, threshold):
    ratio = count / threshold
    if ratio >= 0.8:
        return "danger"
    elif ratio >= 0.5:
        return "warning"
    else:
        return "safe"

def get_grid_metrics(head_boxes, frame_w, frame_h):
    cell_w = max(1, frame_w // GRID_COLS)
    cell_h = max(1, frame_h // GRID_ROWS)
    occupied = set()
    cell_counts = {}
    for x1, y1, x2, y2 in head_boxes:
        cx = max(0, min(frame_w - 1, (x1 + x2) // 2))
        cy = max(0, min(frame_h - 1, (y1 + y2) // 2))
        col = min(GRID_COLS - 1, cx // cell_w)
        row = min(GRID_ROWS - 1, cy // cell_h)
        key = (row, col)
        occupied.add(key)
        cell_counts[key] = cell_counts.get(key, 0) + 1
    per_cell_capacity = max(1, int(round(PEOPLE_PER_CELL)))
    overloaded = {k for (k, v) in cell_counts.items() if v > per_cell_capacity}
    occupied_cells = len(occupied)
    total_cells = GRID_ROWS * GRID_COLS
    occupancy_ratio = (occupied_cells / total_cells) if total_cells > 0 else 0.0
    estimated_capacity = total_cells * PEOPLE_PER_CELL
    density_count = max(len(head_boxes), int(round(occupied_cells * PEOPLE_PER_CELL)))
    return occupied, overloaded, occupied_cells, occupancy_ratio, estimated_capacity, density_count

def draw_grid(frame, occupied, overloaded):
    h, w = frame.shape[:2]
    cell_w = max(1, w // GRID_COLS)
    cell_h = max(1, h // GRID_ROWS)
    for r, c in overloaded:
        x1 = c * cell_w
        y1 = r * cell_h
        x2 = min(w - 1, x1 + cell_w)
        y2 = min(h - 1, y1 + cell_h)
        # Red box: this cell exceeded per-cell capacity.
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
    for r, c in occupied:
        x1 = c * cell_w
        y1 = r * cell_h
        x2 = min(w - 1, x1 + cell_w)
        y2 = min(h - 1, y1 + cell_h)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 90, 255), 1)
    for c in range(1, GRID_COLS):
        x = c * cell_w
        cv2.line(frame, (x, 0), (x, h), (255, 200, 0), 1)
    for r in range(1, GRID_ROWS):
        y = r * cell_h
        cv2.line(frame, (0, y), (w, y), (255, 200, 0), 1)

def build_head_box_from_person_box(x1, y1, x2, y2, frame_w, frame_h):
    w = max(1, x2 - x1)
    h = max(1, y2 - y1)
    head_h = max(8, int(h * 0.34))
    head_w = max(8, int(w * 0.62))
    cx = x1 + (w // 2)
    hx1 = max(0, cx - (head_w // 2))
    hy1 = max(0, y1)
    hx2 = min(frame_w - 1, hx1 + head_w)
    hy2 = min(frame_h - 1, hy1 + head_h)
    return hx1, hy1, hx2, hy2

def intersection_ratio(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0, ix2 - ix1)
    ih = max(0, iy2 - iy1)
    inter = iw * ih
    a_area = max(1, (ax2 - ax1) * (ay2 - ay1))
    return inter / float(a_area)

def detect_fire_candidate(frame_bgr, prev_gray, person_boxes):
    """Fire candidate using color + motion checks to reduce static-light/image false positives."""
    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)

    # Stricter fire-like color ranges (high saturation/brightness).
    mask1 = cv2.inRange(hsv, (5, 170, 170), (28, 255, 255))
    mask2 = cv2.inRange(hsv, (170, 170, 170), (179, 255, 255))
    fire_mask = cv2.bitwise_or(mask1, mask2)
    fire_mask = cv2.medianBlur(fire_mask, 5)

    kernel = np.ones((3, 3), np.uint8)
    fire_mask = cv2.morphologyEx(fire_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    fire_mask = cv2.dilate(fire_mask, kernel, iterations=1)

    contours, _ = cv2.findContours(fire_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    fire_area = 0
    for c in contours:
        area = cv2.contourArea(c)
        if area < 260:
            continue
        x, y, w, h = cv2.boundingRect(c)
        if w < 10 or h < 10:
            continue
        fb = (x, y, x + w, y + h)
        # Reject boxes that mostly overlap person regions (skin/clothes false fire).
        if any(intersection_ratio(fb, pb) > 0.55 for pb in person_boxes):
            continue
        boxes.append(fb)
        fire_area += area

    h, w = frame_bgr.shape[:2]
    frame_area = max(1.0, float(h * w))
    color_ratio = fire_area / frame_area

    motion_ratio = 0.0
    if prev_gray is not None:
        diff = cv2.absdiff(gray, prev_gray)
        _, motion_mask = cv2.threshold(diff, 18, 255, cv2.THRESH_BINARY)
        fire_motion = cv2.bitwise_and(motion_mask, fire_mask)
        fire_pixels = max(1, int(cv2.countNonZero(fire_mask)))
        motion_ratio = float(cv2.countNonZero(fire_motion)) / float(fire_pixels)

    # Candidate needs enough fire color and flicker/motion.
    candidate = (color_ratio > 0.006) and (motion_ratio > 0.10) and (len(boxes) > 0)
    confidence = min(1.0, (color_ratio / 0.02) * 0.55 + (motion_ratio / 0.30) * 0.45)
    return candidate, confidence, boxes, gray

def reset_runtime_state(hard_reset=False):
    global current_stats, latest_frame, processing_active
    
    with lock:
        current_stats["peopleCount"] = 0
        current_stats["instantCount"] = 0
        current_stats["uniqueCount"] = 0
        current_stats["harmfulObjectCount"] = 0
        current_stats["harmfulObjectLabels"] = []
        current_stats["frameVersion"] += 1
        current_stats["riskLevel"] = "safe"
        current_stats["counting"] = False
        current_stats["processingSeconds"] = 0
        current_stats["countMode"] = "head+grid-density"
        current_stats["gridRows"] = GRID_ROWS
        current_stats["gridCols"] = GRID_COLS
        current_stats["occupiedCells"] = 0
        current_stats["occupancyRatio"] = 0.0
        current_stats["estimatedCapacity"] = GRID_ROWS * GRID_COLS * PEOPLE_PER_CELL
        current_stats["densityEstimate"] = 0
        current_stats["harmfulDetectionEnabled"] = HARMFUL_DETECTION_ENABLED
        current_stats["fireDetected"] = False
        current_stats["fireConfidence"] = 0.0
        current_stats["videoOpenError"] = ""
        current_stats["timestamp"] = time.strftime("%H:%M:%S")
        current_stats["trendData"] = []
        current_stats["alerts"] = []
        latest_frame = None
        
        if hard_reset:
            current_stats["logs"] = []
        else:
            current_stats["logs"].insert(0, {
                "timestamp": time.strftime("%H:%M:%S"),
                "event": "System State Reset",
                "count": 0,
                "status": "OK"
            })
            if len(current_stats["logs"]) > 20:
                current_stats["logs"].pop()

def process_video(source, session_id, source_type='video'):
    global processing_active, latest_frame, current_stats, processing_session_id
    
    try:
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            src_desc = "camera" if source_type == "camera" else os.path.basename(str(source))
            with lock:
                current_stats["videoOpenError"] = f"Unable to open source: {src_desc}"
                current_stats["logs"].insert(0, {
                    "timestamp": time.strftime("%H:%M:%S"),
                    "event": current_stats["videoOpenError"],
                    "count": 0,
                    "status": "ERROR"
                })
                if len(current_stats["logs"]) > 20:
                    current_stats["logs"].pop()
            return

        frame_idx = 0
        start_time = time.time()
        last_harmful_signature = None
        prev_fire_gray = None
        fire_persist_frames = 0
        fire_alert_active = False

        last_log_time = time.time()
        
        while processing_active and cap.isOpened():
            with lock:
                if session_id != processing_session_id:
                    break
            ret, frame = cap.read()
            if not ret:
                # Loop uploaded files, but keep trying for live camera.
                if source_type == 'camera':
                    time.sleep(0.03)
                else:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
                
            height, width = frame.shape[:2]
            frame = cv2.resize(frame, (960, 540))
            frame_idx += 1
            
            infer_kwargs = {
                "conf": 0.08,
                "iou": 0.45,
                "imgsz": 640,
                "augment": False,
                "verbose": False,
                "max_det": 500
            }
            vm = get_video_model()
            target_classes = []
            if len(VIDEO_PERSON_CLASS_IDS) > 0:
                target_classes.extend(VIDEO_PERSON_CLASS_IDS)
            if HARMFUL_DETECTION_ENABLED and len(VIDEO_HARMFUL_CLASS_IDS) > 0:
                target_classes.extend(VIDEO_HARMFUL_CLASS_IDS)
            if len(target_classes) > 0:
                infer_kwargs["classes"] = sorted(list(set(target_classes)))
            results = vm(frame, **infer_kwargs)[0]

            print(f"DEBUG: YOLO found {len(results.boxes)} boxes")
            instant_count = 0
            head_boxes = []
            person_boxes = []
            harmful_hits = []
            class_names = vm.names if isinstance(vm.names, dict) else {}

            for box in results.boxes:
                cls_id = int(box.cls[0]) if box.cls is not None else -1
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                
                conf = float(box.conf[0])
                if cls_id in VIDEO_PERSON_CLASS_IDS:
                    person_boxes.append((x1, y1, x2, y2))
                    hx1, hy1, hx2, hy2 = build_head_box_from_person_box(
                        x1, y1, x2, y2, frame.shape[1], frame.shape[0]
                    )
                    # Slightly lower threshold to recover partially occluded heads.
                    if conf >= 0.10 and (hx2 - hx1) >= 8 and (hy2 - hy1) >= 8:
                        head_boxes.append((hx1, hy1, hx2, hy2))
                elif HARMFUL_DETECTION_ENABLED and cls_id in VIDEO_HARMFUL_CLASS_IDS:
                    cls_name = str(class_names.get(cls_id, "harmful"))
                    harmful_hits.append((cls_name, conf, x1, y1, x2, y2))

            instant_count = len(head_boxes)
            for hx1, hy1, hx2, hy2 in head_boxes:
                cv2.rectangle(frame, (hx1, hy1), (hx2, hy2), (0, 255, 0), 2)
                cv2.putText(frame, "Head", (hx1, max(12, hy1 - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 2)
            occupied_cells, occupancy_ratio, estimated_capacity, density_count = 0, 0.0, GRID_ROWS * GRID_COLS * PEOPLE_PER_CELL, instant_count
            occupied = set()
            occupied, overloaded, occupied_cells, occupancy_ratio, estimated_capacity, density_count = get_grid_metrics(
                head_boxes, frame.shape[1], frame.shape[0]
            )
            draw_grid(frame, occupied, overloaded)

            for cls_name, conf, x1, y1, x2, y2 in harmful_hits:
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                cv2.putText(
                    frame,
                    f"{cls_name} {conf:.2f}",
                    (x1, max(10, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 0, 255),
                    2
                )

            fire_candidate, fire_conf, fire_boxes, prev_fire_gray = detect_fire_candidate(
                frame, prev_fire_gray, person_boxes
            )
            if fire_candidate:
                fire_persist_frames += 1
            else:
                fire_persist_frames = max(0, fire_persist_frames - 1)
            fire_detected = fire_persist_frames >= 6
            if fire_detected:
                for x1, y1, x2, y2 in fire_boxes:
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(frame, f"FIRE {fire_conf:.2f}", (x1, max(12, y1 - 6)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                
            now = time.strftime("%H:%M:%S")
            # Create a unique time string for smooth graphing (include frame index)
            unique_time = f"{now}.{frame_idx % 100:02d}"
            # Strictly current-frame count (no cumulative carry-over).
            # Strict visual count: count equals visible head boxes.
            people_count = instant_count
            risk = get_risk_level(people_count, current_stats["threshold"])
            if len(harmful_hits) > 0 or fire_detected:
                risk = "danger"
            
            with lock:
                prev_count = current_stats["peopleCount"]
                current_stats["peopleCount"] = people_count
                current_stats["instantCount"] = instant_count
                current_stats["uniqueCount"] = people_count
                current_stats["occupiedCells"] = occupied_cells
                current_stats["occupancyRatio"] = round(occupancy_ratio, 3)
                current_stats["estimatedCapacity"] = estimated_capacity
                current_stats["densityEstimate"] = density_count
                harmful_labels = sorted(list(set([h[0] for h in harmful_hits])))
                if fire_detected:
                    harmful_labels = sorted(list(set(harmful_labels + ["fire"])))
                current_stats["harmfulObjectCount"] = len(harmful_labels)
                current_stats["harmfulObjectLabels"] = harmful_labels
                current_stats["fireDetected"] = fire_detected
                current_stats["fireConfidence"] = round(float(fire_conf), 3) if fire_detected else 0.0
                current_stats["riskLevel"] = risk
                current_stats["counting"] = True
                current_stats["processingSeconds"] = int(time.time() - start_time)
                current_stats["timestamp"] = now
                
                # Update trendData for every frame for smooth graphing
                current_stats["trendData"].append({"time": unique_time, "count": people_count})
                if len(current_stats["trendData"]) > 100: # Increased limit for smoother transitions
                    current_stats["trendData"].pop(0)
                
                current_time = time.time()
                if people_count != prev_count or (current_time - last_log_time > 5):
                    log_entry = {
                        "timestamp": now,
                        "event": "Crowd Density Update",
                        "count": people_count,
                        "status": "OK" if risk == "safe" else risk.upper()
                    }
                    current_stats["logs"].insert(0, log_entry)
                    if len(current_stats["logs"]) > 20:
                        current_stats["logs"].pop()
                    last_log_time = current_time

                if risk != "safe":
                    if len(current_stats["alerts"]) == 0 or current_stats["alerts"][0]["risk"] != risk or people_count != current_stats["alerts"][0]["count"]:
                        alert = {"timestamp": now, "count": people_count, "risk": risk, "triggered": True}
                        current_stats["alerts"].insert(0, alert)
                        if len(current_stats["alerts"]) > 20:
                            current_stats["alerts"].pop()
                        
                        risk_log = {"timestamp": now, "event": f"{risk.capitalize()} Risk Alert", "count": people_count, "status": risk.upper()}
                        current_stats["logs"].insert(0, risk_log)

                if len(harmful_hits) > 0:
                    harmful_labels = sorted(list(set([h[0] for h in harmful_hits])))
                    harmful_signature = "|".join(harmful_labels)
                    if harmful_signature != last_harmful_signature:
                        harm_log = {
                            "timestamp": now,
                            "event": f"Harmful Object Alert: {', '.join(harmful_labels)}",
                            "count": people_count,
                            "status": "DANGER"
                        }
                        current_stats["logs"].insert(0, harm_log)
                        current_stats["alerts"].insert(0, {"timestamp": now, "count": people_count, "risk": "danger", "triggered": True})
                        if len(current_stats["logs"]) > 20:
                            current_stats["logs"].pop()
                        if len(current_stats["alerts"]) > 20:
                            current_stats["alerts"].pop()
                        last_harmful_signature = harmful_signature

                if fire_detected and not fire_alert_active:
                    fire_alert_active = True
                    fire_log = {
                        "timestamp": now,
                        "event": f"Fire Alert (confidence {fire_conf:.2f})",
                        "count": people_count,
                        "status": "DANGER"
                    }
                    current_stats["logs"].insert(0, fire_log)
                    current_stats["alerts"].insert(0, {"timestamp": now, "count": people_count, "risk": "danger", "triggered": True})
                    if len(current_stats["logs"]) > 20:
                        current_stats["logs"].pop()
                    if len(current_stats["alerts"]) > 20:
                        current_stats["alerts"].pop()
                if (not fire_detected) and fire_alert_active:
                    fire_alert_active = False

                _, buffer = cv2.imencode('.jpg', frame)
                latest_frame = buffer.tobytes()
                current_stats["frameVersion"] += 1
                
            time.sleep(0.005)
            
        cap.release()
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Save error to log so frontend sees it
        with lock:
            current_stats["logs"].insert(0, {"timestamp": time.strftime("%H:%M:%S"), "event": f"CRASH: {str(e)}", "count": 0, "status": "ERROR"})
    finally:
        processing_active = False
        with lock:
            if session_id == processing_session_id:
                current_stats["counting"] = False

def process_image(image_path):
    global latest_frame, current_stats

    try:
        frame = cv2.imread(image_path)
        if frame is None:
            raise ValueError("Unable to read uploaded image")

        frame_h, frame_w = frame.shape[:2]
        frame_area = float(frame_h * frame_w)

        def filter_image_boxes(boxes):
            filtered = []
            for b in boxes:
                cls_id = int(b.cls[0]) if b.cls is not None else -1
                if len(IMAGE_PERSON_CLASS_IDS) > 0 and cls_id not in IMAGE_PERSON_CLASS_IDS:
                    continue
                conf = float(b.conf[0])
                x1, y1, x2, y2 = map(int, b.xyxy[0].tolist())
                w = max(0, x2 - x1)
                h = max(0, y2 - y1)
                area_ratio = (w * h) / frame_area if frame_area > 0 else 0.0

                # Image-only stability filters:
                # - drop very low-confidence detections
                # - drop tiny boxes unless confidence is strong
                if conf < 0.10:
                    continue
                if area_ratio < 0.0010 and conf < 0.20:
                    continue

                filtered.append((x1, y1, x2, y2, conf))
            return filtered

        # Run multi-pass inference to improve still-image recall across varied lighting/angles.
        infer_classes = IMAGE_PERSON_CLASS_IDS if len(IMAGE_PERSON_CLASS_IDS) > 0 else None
        candidate_results = []
        for conf in (0.18, 0.10, 0.05):
            kwargs = {
                "conf": conf,
                "iou": 0.45,
                "imgsz": 1280,
                "augment": False,
                "verbose": False
            }
            if infer_classes is not None:
                kwargs["classes"] = infer_classes
            pass_results = image_model(frame, **kwargs)[0]
            filtered = filter_image_boxes(pass_results.boxes)
            mean_conf = (sum(c for (_, _, _, _, c) in filtered) / len(filtered)) if filtered else 0.0
            candidate_results.append((filtered, mean_conf))

        # Prefer the pass with most valid detections; break ties by confidence quality.
        best_filtered, _ = max(candidate_results, key=lambda item: (len(item[0]), item[1]))

        people_count = len(best_filtered)

        head_boxes = []
        for (x1, y1, x2, y2, conf) in best_filtered:
            hx1, hy1, hx2, hy2 = build_head_box_from_person_box(x1, y1, x2, y2, frame_w, frame_h)
            if conf >= 0.10 and (hx2 - hx1) >= 8 and (hy2 - hy1) >= 8:
                head_boxes.append((hx1, hy1, hx2, hy2))

        people_count = len(head_boxes)
        for (hx1, hy1, hx2, hy2) in head_boxes:
            cv2.rectangle(frame, (hx1, hy1), (hx2, hy2), (0, 255, 0), 2)
            cv2.putText(frame, "Head", (hx1, max(12, hy1 - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 2)
        occupied, overloaded, occupied_cells, occupancy_ratio, estimated_capacity, density_count = get_grid_metrics(
            head_boxes, frame_w, frame_h
        )
        draw_grid(frame, occupied, overloaded)
        # Strict visual count: count equals visible head boxes.
        people_count = len(head_boxes)

        _, buffer = cv2.imencode('.jpg', frame)
        now = time.strftime("%H:%M:%S")
        risk = get_risk_level(people_count, current_stats["threshold"])

        with lock:
            latest_frame = buffer.tobytes()
            current_stats["frameVersion"] += 1
            current_stats["peopleCount"] = people_count
            current_stats["instantCount"] = people_count
            current_stats["uniqueCount"] = people_count
            current_stats["occupiedCells"] = occupied_cells
            current_stats["occupancyRatio"] = round(occupancy_ratio, 3)
            current_stats["estimatedCapacity"] = estimated_capacity
            current_stats["densityEstimate"] = density_count
            current_stats["harmfulObjectCount"] = 0
            current_stats["harmfulObjectLabels"] = []
            current_stats["fireDetected"] = False
            current_stats["fireConfidence"] = 0.0
            current_stats["riskLevel"] = risk
            current_stats["counting"] = False
            current_stats["processingSeconds"] = 0
            current_stats["timestamp"] = now
            current_stats["trendData"] = [{"time": now, "count": people_count}]
            current_stats["logs"].insert(0, {
                "timestamp": now,
                "event": "Image Count Complete",
                "count": people_count,
                "status": "OK" if risk == "safe" else risk.upper()
            })
            if len(current_stats["logs"]) > 20:
                current_stats["logs"].pop()
    except Exception as e:
        with lock:
            current_stats["logs"].insert(0, {
                "timestamp": time.strftime("%H:%M:%S"),
                "event": f"IMAGE PROCESS ERROR: {str(e)}",
                "count": 0,
                "status": "ERROR"
            })

@app.route('/upload', methods=['POST'])
def upload_video():
    global processing_active, uploaded_media_type, processing_session_id
    
    processing_active = False
    processing_session_id += 1
    time.sleep(0.3)
    reset_runtime_state(hard_reset=True)
    
    file = request.files.get('media') or request.files.get('video') or request.files.get('image')
    if file is None:
        return jsonify({"error": "No media file"}), 400
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    _, ext = os.path.splitext(file.filename.lower())
    image_exts = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')
    is_image = ext in image_exts or (file.mimetype is not None and file.mimetype.startswith('image/'))
    if is_image and ext not in image_exts:
        ext = '.jpg'
    video_exts = ('.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v')
    if is_image:
        file_name = 'input_image' + ext
    else:
        if ext not in video_exts:
            ext = '.mp4'
        file_name = 'input_video' + ext
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_name)

    # Remove old input files for clean media switching.
    for old_name in os.listdir(app.config['UPLOAD_FOLDER']):
        if old_name.startswith('input_video') or old_name.startswith('input_image'):
            old_path = os.path.join(app.config['UPLOAD_FOLDER'], old_name)
            if os.path.isfile(old_path):
                try:
                    os.remove(old_path)
                except:
                    pass

    file.save(file_path)
    uploaded_media_type = 'image' if is_image else 'video'
    with lock:
        current_stats["mediaType"] = uploaded_media_type
    return jsonify({"message": "File uploaded successfully", "mediaType": uploaded_media_type})

@app.route('/start', methods=['POST'])
def start_processing():
    global processing_active, uploaded_media_type, processing_session_id
    
    if processing_active:
        processing_active = False
        processing_session_id += 1
        time.sleep(0.3)
        
    request_data = request.get_json(silent=True) or {}
    requested_source = str(request_data.get("source", "")).strip().lower()
    explicit_camera = requested_source in ("camera", "webcam", "live")
    explicit_upload = requested_source in ("upload", "uploaded", "video", "file")

    video_candidates = [
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_video.mp4'),
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_video.mov'),
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_video.avi'),
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_video.mkv'),
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_video.webm'),
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_video.m4v'),
    ]
    video_path = next((p for p in video_candidates if os.path.exists(p)), None)
    image_candidates = [
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_image.jpg'),
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_image.jpeg'),
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_image.png'),
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_image.bmp'),
        os.path.join(app.config['UPLOAD_FOLDER'], 'input_image.webp'),
    ]
    image_path = next((p for p in image_candidates if os.path.exists(p)), None)

    # Default behavior:
    # - If user explicitly requests camera/upload, honor it.
    # - Else if upload exists, process uploaded media.
    # - Else fallback to live camera.
    if explicit_camera:
        use_camera = True
    elif explicit_upload:
        use_camera = False
    else:
        use_camera = (video_path is None and image_path is None)

    reset_runtime_state(hard_reset=True)
    if (not use_camera) and image_path is not None and uploaded_media_type == 'image':
        process_image(image_path)
        return jsonify({"message": "Image processed", "counting": False})

    # Uploaded mode but no playable file (explicit upload with nothing on disk).
    if not use_camera and video_path is None:
        return jsonify({
            "error": "No uploaded media found. Upload a file first, or use live camera."
        }), 400

    source = video_path
    source_type = 'video'
    if use_camera or video_path is None:
        source = 0
        source_type = 'camera'
        uploaded_media_type = 'camera'
    else:
        uploaded_media_type = 'video'

    processing_session_id += 1
    session_id = processing_session_id
    with lock:
        current_stats["mediaType"] = uploaded_media_type
        current_stats["counting"] = True

    processing_active = True
    thread = threading.Thread(target=process_video, args=(source, session_id, source_type))
    thread.daemon = True
    thread.start()

    return jsonify({"message": "Processing started", "counting": True, "mediaType": uploaded_media_type})

@app.route('/stop', methods=['POST'])
def stop_processing():
    global processing_active
    processing_active = False
    time.sleep(0.2)
    reset_runtime_state(hard_reset=False)
    return jsonify({"message": "Processing stopped"})

@app.route('/stats', methods=['GET'])
def get_stats():
    with lock:
        return jsonify(current_stats)

@app.route('/threshold', methods=['POST'])
def update_threshold():
    data = request.get_json(silent=True) or {}
    if 'threshold' not in data:
        return jsonify({"error": "Threshold not provided"}), 400
    try:
        t = int(data['threshold'])
    except (TypeError, ValueError):
        return jsonify({"error": "Threshold must be an integer"}), 400
    if t < 1 or t > 100000:
        return jsonify({"error": "Threshold must be between 1 and 100000"}), 400
    with lock:
        current_stats['threshold'] = t
    return jsonify({"message": "Threshold updated", "threshold": t})

@app.route('/capacity', methods=['POST'])
def update_capacity():
    global GRID_ROWS, GRID_COLS, PEOPLE_PER_CELL
    data = request.get_json(silent=True) or {}

    rows = data.get("gridRows", GRID_ROWS)
    cols = data.get("gridCols", GRID_COLS)
    ppc = data.get("peoplePerCell", PEOPLE_PER_CELL)

    try:
        rows = int(rows)
        cols = int(cols)
        ppc = float(ppc)
    except (TypeError, ValueError):
        return jsonify({"error": "gridRows/gridCols must be integers and peoplePerCell must be numeric"}), 400

    if rows < 2 or rows > 20 or cols < 2 or cols > 20:
        return jsonify({"error": "gridRows and gridCols must be between 2 and 20"}), 400
    if ppc <= 0 or ppc > 10:
        return jsonify({"error": "peoplePerCell must be > 0 and <= 10"}), 400

    GRID_ROWS = rows
    GRID_COLS = cols
    PEOPLE_PER_CELL = ppc

    with lock:
        current_stats["gridRows"] = GRID_ROWS
        current_stats["gridCols"] = GRID_COLS
        current_stats["estimatedCapacity"] = int(round(GRID_ROWS * GRID_COLS * PEOPLE_PER_CELL))

    return jsonify({
        "message": "Capacity settings updated",
        "gridRows": GRID_ROWS,
        "gridCols": GRID_COLS,
        "peoplePerCell": PEOPLE_PER_CELL,
        "estimatedCapacity": int(round(GRID_ROWS * GRID_COLS * PEOPLE_PER_CELL))
    })

@app.route('/harmful_mode', methods=['POST'])
def update_harmful_mode():
    global HARMFUL_DETECTION_ENABLED
    data = request.get_json(silent=True) or {}
    if "enabled" not in data:
        return jsonify({"error": "enabled flag is required"}), 400
    HARMFUL_DETECTION_ENABLED = bool(data.get("enabled"))
    with lock:
        current_stats["harmfulDetectionEnabled"] = HARMFUL_DETECTION_ENABLED
        if not HARMFUL_DETECTION_ENABLED:
            current_stats["harmfulObjectCount"] = 0
            current_stats["harmfulObjectLabels"] = []
    return jsonify({
        "message": "Harmful object detection mode updated",
        "enabled": HARMFUL_DETECTION_ENABLED
    })

def generate_frames():
    global latest_frame
    while True:
        if latest_frame is not None:
            frame_data = latest_frame
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n'
                   b'Content-Length: ' + str(len(frame_data)).encode() + b'\r\n\r\n' + 
                   frame_data + b'\r\n')
            time.sleep(0.02)
        else:
            time.sleep(0.1)

@app.route('/')
def index():
    return jsonify({
        "status": "Sentinel View Backend is running",
        "api_docs": {
            "/health": "GET - check system health",
            "/stats": "GET - get crowd stats",
            "/start": "POST - start processing video",
            "/start (default)": "Starts live camera unless source='upload'",
            "/stop": "POST - stop processing video",
            "/upload": "POST - upload a video file",
            "/capacity": "POST - update grid/capacity settings",
            "/harmful_mode": "POST - enable/disable harmful object detection",
            "/threshold": "POST - set crowd risk threshold (JSON: {threshold: int})"
        }
    })

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/latest_frame.jpg')
def latest_frame_image():
    global latest_frame
    with lock:
        if latest_frame is None:
            return jsonify({"error": "No frame available"}), 404
        frame_data = latest_frame
    response = Response(frame_data, mimetype='image/jpeg')
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/health')
def health():
    with lock:
        return jsonify({
            "status": "healthy",
            "processing": processing_active,
            "counting": current_stats["counting"],
            "mediaType": current_stats["mediaType"]
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)
