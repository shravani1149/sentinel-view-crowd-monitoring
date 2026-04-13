import os
import cv2
import time
import torch
from ultralytics import YOLO

print("Loading model...")
try:
    model = YOLO('models/best.pt')
    if torch.cuda.is_available():
        model.to("cuda")
    print("Model loaded successfully")
except Exception as e:
    import traceback
    traceback.print_exc()

print("Testing processing...")
try:
    cap = cv2.VideoCapture('uploads/input_video.mp4')
    ret, frame = cap.read()
    if ret:
        frame = cv2.resize(frame, (1280, 720))
        results = model(frame, conf=0.25, iou=0.45, imgsz=1280, verbose=False)[0]
        print("Inference success:", len(results.boxes), "detections")
    else:
        print("Couldn't read video frame")
except Exception as e:
    import traceback
    traceback.print_exc()
