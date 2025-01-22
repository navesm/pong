//Game state management
const gameStates = new Map(); // Store game states for each room

const FRAME_RATE = 60;
const width = 500;
const height = 700;
const paddleWidth = 50;
const paddleDiff = 25;


function createGameState() {
  return {
    paddleX: [255, 255],
    ballX: width / 2,
    ballY: height / 2,
    speedY: -3,
    speedX: 0,
    score: [0, 0],
    playerMoved: false,
    paddleContact: false,
    trajectoryX: 0,
    isGameOver: false
  };
}

function ballMove(gameState) {
  gameState.ballY += -gameState.speedY;
  if (gameState.playerMoved && gameState.paddleContact) {
    gameState.ballX += gameState.speedX;
  }
}

function ballBoundaries(gameState) {
  //Bounce off left wall
  if (gameState.ballX < 0 && gameState.speedX < 0) {
    gameState.speedX = -gameState.speedX;
  }
  //Bounce off right wall
  if (gameState.ballX > width && gameState.speedX > 0) {
    gameState.speedX = -gameState.speedX;
  }

  // Bounce off player paddle (bottom)
  if (gameState.ballY > height - paddleDiff) {
    if (gameState.ballX > gameState.paddleX[0] && gameState.ballX < gameState.paddleX[0] + paddleWidth) {
      gameState.paddleContact = true;
      if (gameState.playerMoved) {
        gameState.speedY -= 1;
        if (gameState.speedY < -5) {
          gameState.speedY = -5;
        }
      }
      gameState.speedY = -gameState.speedY;
      gameState.trajectoryX = gameState.ballX - (gameState.paddleX[0] + paddleDiff);
      gameState.speedX = gameState.trajectoryX * 0.3;
    } else if (gameState.ballY > height) {
      // Reset ball, add to computer/player 2 score
      ballReset(gameState);
      gameState.score[1]++;
    }
  }

  //Bounce off computer/ Player 2 paddle (top)
  if (gameState.ballY < paddleDiff) {
    if (gameState.ballX > gameState.paddleX[1] && gameState.ballX < gameState.paddleX[1] + paddleWidth) {
      if (gameState.playerMoved) {
        gameState.speedY += 1;
        if (gameState.speedY > 5) {
          gameState.speedY = 5;
        }
      }
      gameState.speedY = -gameState.speedY;
    } else if (gameState.ballY < 0) {
      ballReset(gameState);
      gameState.score[0]++;
    }
  }
}

function ballReset(gameState) {
  gameState.ballX = width / 2;
  gameState.ballY = height / 2;
  gameState.speedY = -3;
  gameState.speedX = 0;
  gameState.paddleContact = false;
}

function gameLoop(pongNameSpace, room) {
  const gameState = gameStates.get(room);
  if (!gameState || gameState.isGameOver) return;

  ballMove(gameState);
  ballBoundaries(gameState);

  // Emit game state to all players in the room
  pongNameSpace.in(room).emit('gameState', {
    ballX: gameState.ballX,
    ballY: gameState.ballY,
    score: gameState.score,
    paddleX: gameState.paddleX
  });
}




function listen(io) {
  const pongNameSpace = io.of('/pong');
  let readyPlayerCount = 0;

  pongNameSpace.on('connection', (socket) => {
    let room;

    console.log('a user connected', socket.id);

    socket.on('ready', () => {
      room = 'room' + Math.floor(readyPlayerCount / 2);
      socket.join(room);
      console.log('Player ready', socket.id, room);

      //Assign player index based on ready count
      const playerIndex = readyPlayerCount % 2;
      socket.emit('playerAssigned', playerIndex);

      readyPlayerCount++;

      if (readyPlayerCount % 2 === 0) {
        // Create new game state for the room
        gameStates.set(room, createGameState());

        // Start game loop for this room
        const timer = setInterval(() => {
          const start = Date.now();
          gameLoop(pongNameSpace, room);
          const frameTime = Date.now() - start;

          //Adjust next frame timing to maintain 60 FPS
          const nextDelay = Math.max(0, (1000 / 60) - frameTime);
          if (nextDelay < 14) { // If we're getting too close to frame deadline
            console.log('Frame took too long:', frameTime);

          }
        }, 1000 / 150)
        // setInterval(() => gameLoop(pongNameSpace, room), 1000 / FRAME_RATE);

        pongNameSpace.in(room).emit('startGame', socket.id);
      }
    });

    socket.on('paddleMove', (paddleData) => {
      const gameState = gameStates.get(room);
      if (!gameState) return;

      gameState.paddleX[paddleData.playerIndex] = paddleData.xPosition;
      gameState.playerMoved = true;

      //Broadcast paddle position to other player
      socket.to(room).emit('paddleMove', paddleData);
    });

    // socket.on('ballMove', (ballData) => {
    //   socket.to(room).emit('ballMove', ballData);
    // });

    socket.on('disconnect', (reason) => {
      console.log(`Client ${socket.id} disconnected: ${reason}`);
      socket.leave(room);

      // Clean up game state when room is empty
      const roomSockets = Array.from(socket.adapter.rooms.get(room) || []);
      if (roomSockets.length === 0) {
        gameStates.delete(room);
      }
    });
  });
}

module.exports = {
  listen,
};