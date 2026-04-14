// AWS Amplify Lambda function for /start endpoint
exports.handler = async (event) => {
  try {
    // Start processing logic
    const response = {
      counting: true,
      mediaType: null,
      processing: true,
      timestamp: new Date().toISOString(),
      message: 'Processing started'
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to start processing',
        message: error.message 
      })
    };
  }
};
