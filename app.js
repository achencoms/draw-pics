const fs = require('fs');
const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

//Having a dynamic port to allow for Heroku or another hosting service to choose custom port
const port = process.env.PORT || 3000;

//Colors for the name tags
const colors = ["red","black","blue","purple","green","pink","lime","orange"];

//Keeps track of the current drawing
let currDrawing = [];
let currStep = -1;

//Keeps track of the players in the game by name
let nameMappings = {};

//Keeps track of the letters currently shown and the chosen word and user
let currLetters = [];
let chosenWord = "";
let chosenUser = "";

//Keeps track of the state of the game
let globalTimer, letterTimer;
let time, correctResponses;
let notStarted = true;

//Reading in and only choosing words with length greater than 3
const words = fs.readFileSync("words.txt","utf-8").split("\n").filter(word => word.length > 3);

//Allows use of static files in public directory
app.use(express.static("public"));

//Upon entering, the users will be shown the name input
app.get("/", function(req, res) {
  res.sendFile(__dirname + "/index.html");
});

//Establising a Socket.IO connection with the client
io.on("connection", function(socket) {
  console.log("a user has connected!");

  //Upon connecting, a new socket will be able to see what was already drawn
  if(currDrawing.length) socket.emit("redraw", currDrawing[currStep]);

  if(notStarted){
    setup();
  }
  
  //Receiving the users name and attaching it to the socket
  socket.on("name", function(data){
    const id = socket.id;
    nameMappings[id] = data;
    if(notStarted) setup();
  });

  //Receiving user's answers and directing them to all users
  socket.on("answer", function(data){
    const msg = data.trim();
    if(msg != "" && msg === chosenWord){
      //Upon answering, the tracker for the number of people who got it right will increase
      correctResponses++;
      const numOfGuessers = activePlayers() - 1;
      if(correctResponses === numOfGuessers){
        io.emit("message", {"msg" : `Everyone got the correct answer! The next round will be starting soon...`});
        clearTimers();
        io.emit("time",time);
        setTimeout(function(){
          setup();
        }, 5000);
      }
      //Upon answering, the time will shorten to start the next round faster
      else {
        if(time > 10) time = 10;
        io.emit("message", {"msg" : `${nameMappings[socket.id]} got the correct answer!`});
      }
    } else{
      //Redirect the current answer to the general chat
      io.emit("message", {
        "msg" : msg,
        "name" : nameMappings[socket.id]
      });
    }
  });

  //Drawing data is broadcast to all connected sockets
  socket.on("drawData", function(data) {
    io.emit("draw", data);
  });

  //Saving the current image of the drawing to the history
  socket.on("saveDrawing", function(data) {
    currStep++;
    if (currStep < currDrawing.length) {
      currDrawing.length = currStep;
    }
    currDrawing.push(data);
  });

  //Clearing the board is broadcast to all connected sockets
  socket.on("clear", function() {
    console.log("clearing the board!");
    currDrawing = [];
    currStep = -1;
    io.emit("clear");
  });

  //Erasing data is broadcast to all connected sockets
  socket.on("eraser", function(data) {
    io.emit("eraser", data);
  });

  //Redraws / sends information about previous image
  socket.on("undo", function() {
    if (currStep > -1) {
      if (currStep-- === 0) io.emit("clear");
      else {
        io.emit("redraw", currDrawing[currStep]);
      }
    }
  });

  //Redoes from whatever the current state of the image is
  socket.on("redo", function() {
    if (currStep < currDrawing.length - 1) {
      currStep++;
      io.emit("redraw", currDrawing[currStep]);
    }
  });

  //Resets the game to allow for the new connected sockets to join
  socket.on("reset", function(){
    clearTimers();
    setup();
  });

  //Detect whether or not the user has disconnected
  socket.on("disconnect", function(){
    delete nameMappings[socket.id];
    console.log("A user has disconnected!");
    //Ending the game if there is less than 2 users to play.
    if(activePlayers() < 2){
      clearTimers();
      io.emit("reset");
      notStarted = true;
    }
  });

});

http.listen(port, function() {
  console.log(`Listening to port ${port}`);
});

//Helper Functions
//Chooses a random item from the provided array, specifically current letters or avaliable clients
function randChoice(array){
  let randChoice = array[randIndex(array.length)];
  if(array === words){
    currLetters = [];
    while(randChoice === chosenWord){
      randChoice = array[randIndex(array.length)];
    }
    chosenWord = randChoice.trim();
    for(let i = 0; i < chosenWord.length; i++){
      if(chosenWord.charAt(i) == " "){
        currLetters.push("-");
      } else currLetters.push("");
    }
  } else{
    while(randChoice === chosenUser){
      randChoice = array[randIndex(array.length)];
    }
    chosenUser = randChoice;
  }
  return randChoice;
}

//Chooses a random letter from the chosen word
function randLetter(){
  let index = randIndex(chosenWord.length);
  //Reassigns index if the current letter has already been used
  while(currLetters[index] != ""){
    index = randIndex(chosenWord.length);
  }
  //Check 
  currLetters[index] = chosenWord.charAt(index);
}

function setup(){
  io.sockets.clients((error,clients) => {
     //Checking if the game has enough users to begin the game
    if(activePlayers() > 1){
      //Once the game has been initiated, it will not allow new players to join in
      notStarted = false;
      
      //Clearing the users' screens and choosing the drawer
      time = 70;
      correctResponses = 0;
      io.emit("reset");
      io.emit("time",time);
      io.to(randChoice(clients)).emit("chosen",randChoice(words));
      io.emit("word",currLetters);
      
      //Setup the timer to give letters until there are only 2 missing
      letterTimer = setInterval(function(){
        randLetter();
        io.emit("word",currLetters);
      }, 60000 / (chosenWord.length / 2));
  
      //Setup global timer for the game
      //Maybe implement it so that there is a cooldown period where the game announces that the next round is about to start
      globalTimer = setInterval(function(){
        if(time === 1){
          clearTimers();
          io.emit("time",time);
          io.emit("message", {"msg" : "The next round will be starting soon..."}); 
          setTimeout(function(){
            setup();
          }, 5000);
        }
        time--;
        io.emit("time",time);
      }, 1000);
    }
  });
}

function randIndex(max){
  return Math.floor(Math.random() * max);
}

function clearTimers(){
  clearInterval(letterTimer);
  clearInterval(globalTimer);
  time = 0;
}

function activePlayers(){
  return Object.keys(nameMappings).length;
}