const fs = require('fs');
const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

//Having a dynamic port to allow for Heroku or another hosting service to choose custom port
const port = process.env.PORT || 3000;

//Keeps track of the current drawing and current state of the game
let currDrawing = [];
let currStep = -1;
let currLetters = [];
let chosenWord = "";
let chosenUser = "";
let globalTimer, timer;
let notStarted = true;

const words = fs.readFileSync("words.txt","utf-8").split("\n").filter(word => word.length > 3);

app.use(express.static("public"));

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", function(socket) {
  console.log("a user has connected!");

  //Upon connecting, a new socket will be able to see what was already drawn
  if(currDrawing.length) socket.emit("redraw", currDrawing[currStep]);

  if(notStarted){
    setup();
  }

  //Receiving user's answers and directing them to all users
  socket.on("answer", function(data){
    if(data === chosenWord){
      clearInterval(globalTimer);
      setup();
    }
    io.emit("message", data);
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
    setup();
  });

});

http.listen(port, function() {
  console.log(`Listening to port ${port}`);
});

//Helper Functions
function randChoice(array){
  let randChoice = array[Math.floor(Math.random() * array.length)];
  if(array === words){
    currLetters = [];
    while(randChoice === chosenWord){
      randChoice = array[Math.floor(Math.random() * array.length)];
    }
    chosenWord = randChoice.trim();
    currLetters = Array(chosenWord.length).fill("");
  } else{
    while(randChoice === chosenUser){
      randChoice = array[Math.floor(Math.random() * array.length)];
    }
    chosenUser = randChoice;
  }
  return randChoice;
}

function randLetter(){
  let randIndex = Math.floor(Math.random() * chosenWord.length);
  while(currLetters[randIndex] != ""){
    randIndex = Math.floor(Math.random() * chosenWord.length);
  }
  currLetters[randIndex] = chosenWord.charAt(randIndex);
}

function setup(){
  io.sockets.clients((error,clients) => {
     //Checking if the game has enough users to begin the game
    if(clients.length > 1){
      notStarted = false;
      io.emit("reset");
      io.to(randChoice(clients)).emit("chosen",randChoice(words));
      io.emit("word",currLetters);
      
      //Setup the timer to give letters until there are only 2 missing
      timer = setInterval(function(){
        randLetter();
        io.emit("word",currLetters);
      }, 60000 / (chosenWord.length - 2));
  
      //Setup global timer for the game
      globalTimer = setInterval(function(){
        clearInterval(timer);
        clearInterval(globalTimer);
        setup();
      },60000 + 10000 / (chosenWord.length));
    }
  });
}