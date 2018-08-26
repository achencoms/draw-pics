$(document).ready(function() {
  const socket = io();
  const curr = {
    tool: "pencil"
  };

  socket.on("draw", function(data) {
    drawLine(data);
  });

  socket.on("clear", function() {
    clearCanvas();
  });

  socket.on("eraser", function(data) {
    erase(data);
  });

  socket.on("redraw", function(data) {
    redraw(data);
  });

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

  function drawLine({ x1, y1, x2, y2, width }) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = curr.color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function redraw(data) {
    let lastDraw = new Image();
    lastDraw.src = data;
    lastDraw.onload = function() {
      clearCanvas();
      ctx.drawImage(lastDraw, 0, 0);
    };
  }

  function erase(data) {
    ctx.clearRect(data.x + 13, data.y + 4, 20, 39);
  }

  function clearCanvas() {
    ctx.clearRect(0, 0, c.width, c.height);
  }

  c.addEventListener("mousedown", function(evt) {
    isMouseDown = true;
    const pos = getMousePos(c, evt);
    curr.x = pos.x;
    curr.y = pos.y;
    if (curr.tool == "eraser") {
      ctx.clearRect(pos.x + 13, pos.y + 4, 20, 39);
    }
  });

  c.addEventListener("mouseup", function(evt) {
    isMouseDown = false;
    currentDrawing = c.toDataURL();
    socket.emit("saveDrawing", currentDrawing);
  });

  c.addEventListener("mousemove", function(evt) {
    if (isMouseDown) {
      const pos = getMousePos(c, evt);
      if (curr.tool == "pencil") {
        const x = pos.x;
        const y = pos.y;
        const data = {
          x1: curr.x,
          y1: curr.y,
          x2: x,
          y2: y,
          width: $("#radius").val()
        };
        socket.emit("drawData", data);
        curr.x = x;
        curr.y = y;
      } else {
        socket.emit("eraser", pos);
      }
    }
  });

  $("#clear").on("click", function() {
    socket.emit("clear");
  });

  //Either reverts to a previous state of the canvas or a more current state of the canvas (undo/redo)
  $(".do").on("click", function() {
    const id = $(this).attr("id");
    socket.emit(id);
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
