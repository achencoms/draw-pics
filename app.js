const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

//Having a dynamic port to allow for Heroku or another hosting service to choose custom port
const port = process.env.PORT || 3000;

//Keeps track of the current drawing
let currDrawing = [];
let currStep = -1;

app.use(express.static("public"));

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", function(socket) {
  console.log("a user has connected!");

  //Upon connecting, a new socket will be able to see what was already drawn
  socket.emit("redraw", currDrawing[currStep]);

  //Checking if the game has enough users to begin the game
  io.sockets.clients((error,clients) => {
    if(clients.length > 3){
      const randClient = clients[Math.floor(Math.random() * clients.length)];
      io.to(randClient).emit("chosen","You have been chosen!");
    }
  });

  //Receiving user's answers and directing them to all users
  socket.on("answer", function(data){
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

  socket.on("redo", function() {
    if (currStep < currDrawing.length - 1) {
      currStep++;
      io.emit("redraw", currDrawing[currStep]);
    }
  });
});

http.listen(port, function() {
  console.log(`Listening to port ${port}`);
});
