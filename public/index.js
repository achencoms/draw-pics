$(document).ready(function() {
  const socket = io();
  const curr = {
    tool: "pencil",
    isChosen: false,
    color: "black"
  };

  //Setting the color of the title different each time (reason: yes.)
  const colors = [
    "blue",
    "lime",
    "red",
    "magenta",
    "orange",
    "green",
    "pink",
    "gold"
  ];
  let randInt = Math.floor(Math.random() * colors.length);

  $(".letter").each(function(index) {
    $(this).css("color", colors[(randInt + index) % colors.length]);
  });

  $("colors-item").on("click", function() {
    $;
  });

  //Listens for any new drawing data
  socket.on("draw", function(data) {
    drawLine(data);
  });

  //removes all the previous and existing states of the canvas in the server
  socket.on("clear", function() {
    clearCanvas();
  });

  //Listens for any new erased data
  socket.on("eraser", function(data) {
    erase(data);
  });

  //Listens for any calls to redraw the canvas, used to redo and undo
  socket.on("redraw", function(data) {
    redraw(data);
  });

  //Resets the ui to reflect a user answering
  socket.on("reset", function() {
    socket.emit("clear");
    $(".timer").fadeOut();
    $(".chat").empty();
    $("#word").empty();
    $(".chat-group").hide();
    $(".drawing-tools").hide();
    $("canvas").css("cursor", "default");
    curr.isChosen = false;
  });

  //Used to notify the user that he or she has been chosen to draw
  socket.on("chosen", function(data) {
    $(".chat-group").hide();
    $(".wordReveal").text(`Current Word: ${data}`);
    $(".drawing-tools").css("display", "flex");
    $("canvas").css("cursor", "url(pencil.png), auto");
    curr.isChosen = true;
  });

  //Players will receive the current state of the word to display on the screen
  socket.on("word", function(data) {
    $(".timer").fadeIn();
    if (!curr.isChosen) {
      $(".chat-group").show();
      setupWord(data);
    }
  });

  //Receiving the current round time
  socket.on("time", function(data) {
    if (data === 0) $(".timer").fadeOut();
    $(".timer").text(data);
  });

  //Disable the ability to answer any further
  socket.on("correct", function(data) {
    $(".chat-group").hide();
  });

  //Show whole word upon finishing the round
  socket.on("showWord", function(data) {
    if (!curr.isChosen) {
      setupWord(data.split(""));
    }
  });

  //Receives the emitted message from the server
  socket.on("message", function(data) {
    let output = `<p><b>${data.msg}</b></p>`;
    if (data.name) {
      output = `<p><b style='color: ${data.color}'>${data.name}</b>: ${
        data.msg
      }</p>`;
    }
    $(".chat").append(output);
    $(".chat").animate(
      {
        scrollTop: $(".chat")[0].scrollHeight
      },
      400
    );
  });

  //keeping track of canvas and whether or not the user is currently drawing
  const c = document.getElementById("main");
  const ctx = c.getContext("2d");
  let isMouseDown = false;

  function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }

  //Draws based position parameters and pencil confirguration
  function drawLine({ x1, y1, x2, y2, width, color }) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  //Forces the canvas to draw over itself with an image (memory intensive compared to redrawing a saved state of instruction set, but much smoother)
  function redraw(data) {
    let lastDraw = new Image();
    lastDraw.src = data;
    lastDraw.onload = function() {
      clearCanvas();
      ctx.drawImage(lastDraw, 0, 0);
    };
  }

  //Erases the canvas at the position of the cursor
  function erase(data) {
    ctx.clearRect(data.x + 13, data.y + 4, 20, 39);
  }

  //Clears the canvas
  function clearCanvas() {
    ctx.clearRect(0, 0, c.width, c.height);
  }

  //Setup for the game, specifically the word
  function setupWord(letters) {
    $("#word").empty();
    for (let i = 0; i < letters.length; i++) {
      let newEmpty = $("<input>", {
        type: "text",
        class: "letter",
        value: letters[i],
        disabled: "disabled",
        maxLength: "1"
      });
      $("#word").append(newEmpty);
    }
  }

  //Allows the user to edit the canvas depending on whether or not the mouse button is down
  c.addEventListener("mousedown", function(evt) {
    if (curr.isChosen) {
      isMouseDown = true;
      const pos = getMousePos(c, evt);
      curr.x = pos.x;
      curr.y = pos.y;
      if (curr.tool == "eraser") {
        ctx.clearRect(pos.x + 13, pos.y + 4, 20, 39);
      }
    }
  });

  //Upon release of the mouse button, the current state of the canvas is saved for undo/redo.
  c.addEventListener("mouseup", function(evt) {
    if (curr.isChosen) {
      isMouseDown = false;
      currentDrawing = c.toDataURL();
      socket.emit("saveDrawing", currentDrawing);
    }
  });

  //Gathers positional information about the cursor
  c.addEventListener("mousemove", function(evt) {
    if (curr.isChosen && isMouseDown) {
      const pos = getMousePos(c, evt);
      if (curr.tool == "pencil") {
        const x = pos.x;
        const y = pos.y;
        const data = {
          x1: curr.x,
          y1: curr.y,
          x2: x,
          y2: y,
          width: $("#radius").val() * 2,
          color: curr.color
        };
        socket.emit("drawData", data);
        curr.x = x;
        curr.y = y;
      } else {
        socket.emit("eraser", pos);
      }
    }
  });

  //Submits the name that the user chooses
  $("#name-sub").on("click", function(evt) {
    evt.preventDefault();
    const name = $("#name-box").val();
    //Check if the name isn't empty
    if (name.trim() != "") {
      //Save the name for later use in server to keep track of points
      socket.emit("name", name);
      $(".welcome").hide();
      $(".game").show();
    }
  });

  //Submits the current value in the textbox and clears it
  $("#answer-sub").on("click", function(evt) {
    evt.preventDefault();
    const ans = $("#answer");
    socket.emit("answer", ans.val());
    ans.val("");
  });

  //Calls upon clearCanvas() and clears the entirety of the save states
  $("#clear").on("click", function() {
    socket.emit("clear");
  });

  //Either reverts to a previous state of the canvas or a more current state of the canvas (undo/redo)
  $(".do").on("click", function() {
    const id = $(this).attr("id");
    socket.emit(id);
  });

  //Allows the drawer to reset the game so that he or she cans skip turn
  $(".reset").on("click", function() {
    socket.emit("reset");
  });

  //Chooses color based on which color block is clicked
  $(".colors-item").on("click", function() {
    $(".colors-item").removeClass("colors-item-selected");
    $(this).addClass("colors-item-selected");
    const color = $(this).css("background-color");
    curr.color = color;
  });

  //Configures which tool the user wishes to use
  $(".option").on("click", function() {
    $(".option").removeClass("selected");
    $(this).addClass("selected");
    const id = $(this).attr("id");
    if (id === "pencil") {
      curr.tool = "pencil";
      $("canvas").css("cursor", "url(pencil.png), auto");
    } else if (id === "eraser") {
      curr.tool = "eraser";
      $("canvas").css("cursor", "url(eraser.png), auto");
    }
  });
});
