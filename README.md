# Shopping Assistant

## About

Your personal assistant. Ask me for any product recommendations or help you need. This is the backend repository which controls the user chats as well as product intents, this can be used by any frontend chat application.

## Frontend

You can use our chat app frontend to test the implementation.

`https://github.com/sadiq-ai/chatbot-fe`

## Project Stucture

### app.js

This is the root of the project, all the dependencies and api middlewares are defined here.

### controller.js

This file has the implementations and functions to call Gemini model to filter out user responses and getting product intents.

## How to run

`git clone https://github.com/sadiq-ai/chatbot-be`

`cd chatbot-be`

`echo GENAI_API_KEY="<YOUR GWMINI KEY>" > .env`

`echo PORT="4000" >> .env`

`npm install`

`npm run start`

`call the api at http://localhost:PORT/talk-to-ai`
