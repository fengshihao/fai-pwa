
const { Configuration, OpenAIApi } = require("openai");

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${event.body}`);
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const openai = new OpenAIApi(configuration);
    let body = event.body;
    if (body instanceof String) {
        body = JSON.parse(body);
    }
    const response = await openai.createCompletion(body);
    const data = JSON.stringify(response.data);
    console.log(`event response : type ${typeof data} : ${data}`);
    return {
        statusCode: 200,
    //  Uncomment below to enable CORS requests
     headers: {
         "Access-Control-Allow-Origin": "*",
         "Access-Control-Allow-Headers": "*"
     }, 
        body: data,
    };
};
