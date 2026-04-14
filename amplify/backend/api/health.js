// AWS Amplify Lambda function for /health endpoint
exports.handler = async (event) => {
  try {
    const health = {
      status: "healthy",
      processing: false,
      mediaType: null,
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(health)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Health check failed' })
    };
  }
};
