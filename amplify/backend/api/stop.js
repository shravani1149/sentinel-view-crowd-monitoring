// AWS Amplify Lambda function for /stop endpoint
exports.handler = async (event) => {
  try {
    // Stop processing logic
    const response = {
      counting: false,
      processing: false,
      timestamp: new Date().toISOString(),
      message: 'Processing stopped'
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
        error: 'Failed to stop processing',
        message: error.message 
      })
    };
  }
};
