// AWS Amplify Lambda function for /upload endpoint
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.handler = async (event) => {
  try {
    // Handle file upload to S3
    const { content, filename, contentType } = JSON.parse(event.body);
    
    // Upload file to S3
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `uploads/${filename}`,
      Body: Buffer.from(content, 'base64'),
      ContentType: contentType
    };

    await s3.upload(params).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true,
        message: 'File uploaded successfully',
        filename: filename
      })
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Upload failed',
        message: error.message 
      })
    };
  }
};
