const fs = require("fs");
const productData = require("./all_products.json");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const fileManager = new GoogleAIFileManager(process.env.GENAI_API_KEY);
const genAI = new GoogleGenerativeAI(process.env.GENAI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction:
    "You are a helpful human shopping assistant, your job is to help user find what they are looking for, keep the conversation as natural as you can, ask questions to fill out missing variables, provide your recommendations from internet as well like any sales person would do. Keep the tone human like, slightly engaging, but professional.",
});

// Fill out data for the product attributes
const all_prod_strings = productData.map((prod) => {
  let prod_string = "";
  for (let key in prod) {
    prod_string += `${prod[key]} `;
  }
  return {
    id: prod._id,
    text: prod_string,
  };
});
console.log("Products trained", all_prod_strings.length);

// Define the intent keywords that will be used to recognize user intents
let intents = {
  // Product Attributes
  id: null,
  name: null,
  brand: null,
  category: null,
  color: null,
  size: null,
  type: null,
  price: null,
  gender: null,
  audiance: null,
  material: null,
  occasion: null,
  usage: null,
};

let chat_history = [];
let product_search = [];

async function addVoiceMessage(req, res) {
  try {
    const { base64, text } = req.body;

    let file_metadata;
    let user_request;
    if (base64) {
      // Convert base64 to audio file and save it audio_prompt.wav
      let audioFile = Buffer.from(base64, "base64");
      fs.writeFileSync("audio_prompt_node.wav", audioFile);
      console.log("Audio file saved");
      // Upload the audio file to Google Cloud Storage
      audioFile = await fileManager.uploadFile("audio_prompt_node.wav", { mimeType: "audio/wav" });
      console.log("Audio file uploaded");
      file_metadata = {
        fileData: {
          mimeType: audioFile.file.mimeType,
          fileUri: audioFile.file.uri,
        },
      };

      // Generate content using a prompt and the metadata of the uploaded file.
      user_request = await model.generateContent([
        file_metadata,
        {
          text: `What is user asking for, or replying? Summary in short sentence, keep the important details. If you can't understand the audio, ask user to repeat or provide a text version of the audio.`,
        },
      ]);
      console.log("User content generated");

      // Print the response.
      console.log("user:", user_request.response.text());
      user_request = user_request.response.text().trim();
    } else {
      user_request = text;
    }

    chat_history.push({ user: user_request });

    const chat_history_context = fetchChatHistory(chat_history);

    // Check if User is finalizing the product
    const finalize = await model.generateContent(
      'According to the chat history and the last text from user, is user finalizing the product and asking to add this to cart or place order on it? return "cart" or "order" or "no". chat_history: ' +
        chat_history_context
    );
    console.log("finalize:", finalize.response.text());
    if (finalize.response.text().trim() != "no" && product_search.length > 0) {
      // Clear chat history and intents
      chat_history = [];
      for (let key in intents) {
        intents[key] = null;
      }
      let body = {};
      if (finalize.response.text().trim() == "cart") {
        body = {
          status: "success",
          message: "Audio file received",
          user: user_request,
          data: `Product added to cart on ${Date().toLocaleString()} successfully. Please proceed to checkout to place the order.`,
          product_search: [],
        };
      } else if (finalize.response.text().trim() == "order") {
        body = {
          status: "success",
          message: "Audio file received",
          user: user_request,
          data: `Order placed on ${Date().toLocaleString()} successfully for the product you've selected. Thank you for shopping with us.`,
          product_search: [],
        };
      }
      return res.send(body);
    }

    // Check and tally if user has switched the product, or is asking for a new product, if so reset the intents
    const reset_chat = await model.generateContent(
      'According to the chat history and the last text from user, has user switched the product or asking for a new product? return "yes" or "no". chat_history: ' +
        chat_history_context
    );

    console.log("reset_chat:", reset_chat.response.text());
    if (reset_chat.response.text().trim() == "yes") {
      // Clear chat history and intents
      chat_history = [{ user: user_request }];
      for (let key in intents) {
        intents[key] = null;
      }
    }

    // Convert the product intent to a string
    const prod_attributes = JSON.stringify(intents);
    // Generate content using the user request and the chat history.
    const text_prompt = `Fill out missing variables by asking user questions one by one, avoid repeating yourself and gather information to fillout the variables, but not all at once ask it via a natural conversation, if any information couldn't be found keep it null, try to give your suggestions and recomendations from internet aswell to help user find what their looking for, if user is open to a particular option, dont ask for it repetatively. \nvariables: ${prod_attributes}.\nFollowing is the chat history:\n${chat_history_context}`;

    // console.log("text_prompt:", text_prompt);

    const chatbot_response = await model.generateContent(text_prompt);

    console.log("chatbot:", chatbot_response.response.text());
    chat_history.push({ chatbot: chatbot_response.response.text() });

    // Filling out the product attributes and provide a json response
    const fillout = await model.generateContent(
      `Following is the chat_history :\n${fetchChatHistory(
        chat_history
      )}. Fill me out the missing variables in the product attributes ${JSON.stringify(
        intents
      )} based on the conversation.\nProvide me the filled out product attributes in json string format, keep the missing variables as null.`
    );

    console.log("fillout:", fillout.response.text());
    const filloutResponseText = fillout.response.text();
    const jsonString = filloutResponseText.substring(
      filloutResponseText.indexOf("{"),
      filloutResponseText.lastIndexOf("}") + 1
    );
    intents = JSON.parse(jsonString);

    product_search = [];
    // Now check the query in the product data if any word matches, add it to the product_search
    for (let i = 0; i < all_prod_strings.length; i++) {
      const prod = all_prod_strings[i];
      // Iterate through the product attributes, intents
      let count = 0;
      for (let key in intents) {
        if (intents[key]) {
          const value = intents[key].toString().toLowerCase();
          // Count the number of values that match the product string
          if (prod.text.toLowerCase().includes(value)) {
            count++;
          }
        }
      }
      // If the count is greater than 1, add the product to the search
      if (count > 1) {
        product_search.push({ _id: prod.id, product_text: prod.text, score: count });
      }
    }
    console.log("Product search:", product_search.length);
    // Sort the product search by the score
    product_search.sort((a, b) => b.score - a.score).slice(0, 1);
    let search_results;
    if (product_search && product_search[0]) search_results = fetchProductDetails(product_search[0]._id);

    const body = {
      status: "success",
      message: "Audio file received",
      user: user_request,
      data: chatbot_response.response.text(),
      product_search: search_results ?? [],
    };
    return res.send(body);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}

function fetchChatHistory(chat_history) {
  // Last 10 chat history to give context to the chatbot
  return (chat_history_context = chat_history
    .slice(-10)
    .map((chat) => {
      if (chat.user) {
        return `User: ${chat.user}`;
      } else {
        return `Chatbot: ${chat.chatbot}`;
      }
    })
    .join("\n"));
}

function fetchProductDetails(id) {
  return productData.filter((prod) => prod._id == id);
}

module.exports = {
  addVoiceMessage,
};
