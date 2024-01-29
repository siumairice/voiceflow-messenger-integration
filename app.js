'use strict';

const axios = require('axios');

// Use dotenv to read .env vars into Node
require('dotenv').config();

const apiKey = process.env.API_KEY;
const userID = 'test_id'; // Unique ID used to track conversation state


// Imports dependencies and set up http server
const
  request = require('request'),
  express = require('express'),
  { urlencoded, json } = require('body-parser'),
  app = express();

// Parse application/x-www-form-urlencoded
app.use(urlencoded({ extended: true }));

// Parse application/json
app.use(json());

// Respond with 'Hello World' when a GET request is made to the homepage
app.get('/', function (_req, res) {
  res.send('Hello World');
});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

  // Your verify token. Should be a random string.
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {

    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {

      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);

    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Creates the endpoint for your webhook
app.post('/webhook', (req, res) => {
  let body = req.body;

  // Checks if this is an event from a page subscription
  if (body.object === 'page') {

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(async function(entry) {

      // Gets the body of the webhook event
      let webhookEvent = entry.messaging[0];
      console.log(webhookEvent);

      // Get the sender PSID
      let senderPsid = webhookEvent.sender.id;
      console.log('Sender PSID: ' + senderPsid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhookEvent.message) {
        await handleMessage(senderPsid, webhookEvent.message);
      } else if (webhookEvent.postback) {
        await handlePostback(senderPsid, webhookEvent.postback);
      }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {

    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

//--------------------------------------MESSAGE HANDLERS-------------------------------------------//

// Handles messages events
async function handleMessage(senderPsid, receivedMessage) {
  let response = {}
  let voiceflow;
  let new_buttons = []
  
  voiceflow = await startInteract(receivedMessage.text)

  for(let i = 0; i < voiceflow.length; i++){
    if(voiceflow[i].type == 'text'){
      response = {
        text: voiceflow[i].payload.message
        
      }
      console.log(response)
      callSendAPI(senderPsid, response)
    }

    if (voiceflow[i].type == 'choice'){
      
      let voiceflow_buttons = voiceflow[i].payload.buttons

      for(let j = 0; j < 3; j++){
          new_buttons.push({
          "type": 'postback',
          "title": voiceflow_buttons[j].name,
          "payload": voiceflow_buttons[j].name})
      }
      response = {
        'attachment': {
          'type': 'template',
          'payload': {
            'template_type': 'generic',
            'elements': [{
              'title': 'How can we help you?',
              'subtitle': 'Tap a button to answer.',
              'buttons': 
                new_buttons
              ,
            }]
          }
        }
      };
      callSendAPI(senderPsid, response);
    }
    
  }
  
}

// Handles messaging_postbacks events
async function handlePostback(senderPsid, receivedPostback) {
  let response = {}
  let new_buttons = []
  // Get the payload for the postback
  let payload = receivedPostback.payload;
  let voiceflow = await startInteract(payload)
  for(let i = 0; i < voiceflow.length; i++){
    if(voiceflow[i].type == 'text'){
      response = {
        text: voiceflow[i].payload.message
        
      }
      callSendAPI(senderPsid, response)
    }
    if (voiceflow[i].type == 'choice'){
      let voiceflow_buttons = voiceflow[i].payload.buttons
      console.log(voiceflow_buttons)
      for(let j = 0; j < 3; j++){
          new_buttons.push({
          "type": 'postback',
          "title": voiceflow_buttons[j].name,
          "payload": voiceflow_buttons[j].name})
      }
      response = {
        'attachment': {
          'type': 'template',
          'payload': {
            'template_type': 'generic',
            'elements': [{
              'title': 'How can we help you?',
              'subtitle': 'Tap a button to answer.',
              'buttons': 
                new_buttons
              ,
            }]
          }
        }
      };
      callSendAPI(senderPsid, response);
    }
  }
  
}

// Sends response messages via the Send API
function callSendAPI(senderPsid, response) {

  // The page access token we have generated in your app settings
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  // Construct the message body
  let requestBody = {
    'recipient': {
      'id': senderPsid
    },
    'message': response
  };

  // Send the HTTP request to the Messenger Platform
  request({
    'uri': 'https://graph.facebook.com/v2.6/me/messages',
    'qs': { 'access_token': PAGE_ACCESS_TOKEN },
    'method': 'POST',
    'json': requestBody
  }, (err, _res, _body) => {
    if (!err) {
      console.log('Message sent!');
    } else {
      console.error('Unable to send message:' + err);
    }
  });
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});


async function startInteract(userInput) {
  const body = {
    action: {
      type: 'text',
      payload: userInput,
    },
  };
  // Start a conversation
  const response = await axios({
    method: 'POST',
    baseURL: 'https://general-runtime.voiceflow.com',
    url: `/state/user/${userID}/interact`,
    headers: {
      Authorization: apiKey,
      versionID: 'development'
    },
    data: body,
  });
  console.log(response.data)
  return response.data
}

startInteract().catch((error) => console.error(error));
