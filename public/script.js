// Canvas
const { body } = document;
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');
const socket = io('http://localhost:3000');
let isMultiplayer = false;
let isReferee = false;
let paddleIndex = 0;





const width = 500;
const height = 700;
const screenWidth = window.screen.width;
const canvasPosition = screenWidth / 2 - width / 2;
const isMobile = window.matchMedia('(max-width: 600px)');
const gameOverEl = document.createElement('div');

// Paddle
const paddleHeight = 10;
const paddleWidth = 50;
const paddleDiff = 25;

let paddleX = [225, 225]
let playerMoved = false;
let paddleContact = false;

//Multiplayer state tracking
let playersReady = 0;
let gameStarted = false;

// Ball
let ballX = 250;
let ballY = 350;
const ballRadius = 5;

// Speed
let speedY;
let speedX;
let trajectoryX = [0, 0];
let computerSpeed;

// Change Mobile Settings
if (isMobile.matches) {
  speedY = -2;
  speedX = speedY;
  computerSpeed = 4;
} else {
  speedY = -1;
  speedX = speedY;
  computerSpeed = 3;
}

// Score
let score = [0, 0];
const winningScore = 7;
let isGameOver = true;
let isNewGame = true;


function resetGameState() {
  //Reset all game-related variables
  isGameOver = false;
  isNewGame = true;
  gameStarted = false;
  playersReady = 0;
  playerMoved = false;
  paddleContact = false;
  score = [0, 0];
  paddleX = [225, 225];
  ballReset();
}

function cleanup() {
  canvas.hidden = true;
  //Reset all event listeners
  canvas.removeEventListener('mousemove', handleMouseMove);

  //Disconnect socket if in multiplayer
  if (isMultiplayer && socket.connected) {
    socket.disconnect();
  }

  //Reset game state
  resetGameState();
}

// Create mousemove handler
function handleMouseMove(e) {
  playerMoved = true;
  // Compensate for canvas being centered
  // Get canvas position relative to the viewport
  const canvasRect = canvas.getBoundingClientRect();
  // Calculate paddle position based on the mouse event and canvas position
  paddleX[paddleIndex] = e.clientX - canvasRect.left;

  // Clamp paddle position to stay within canvas bounds
  if (paddleX[paddleIndex] < 0) {
    paddleX[paddleIndex] = 0;
  }
  if (paddleX[paddleIndex] > (width - paddleWidth)) {
    paddleX[paddleIndex] = width - paddleWidth;
  }

  if (isMultiplayer) {
    socket.emit('paddleMove', {
      xPosition: paddleX[paddleIndex],
      playerIndex: paddleIndex,
    });
  }

  // Hide Cursor
  canvas.style.cursor = 'none';
}
// Create Canvas Element
function createCanvas() {
  canvas.width = width;
  canvas.height = height;
  canvas.hidden = false;
  body.appendChild(canvas);
  renderCanvas();
}

//Wait for Opponents
function renderIntro() {
  //Canvas Background
  context.fillStyle = 'black';
  context.fillRect(0, 0, width, height);

  //Intro Text
  context.fillStyle = 'white';
  context.font = "32px Courier New";
  context.fillText("Waiting for opponent...", 20, (canvas.height / 2) - 30);
}

// Render Everything on Canvas
function renderCanvas() {
  // Canvas Background
  context.fillStyle = 'black';
  context.fillRect(0, 0, width, height);

  // Paddle Color
  context.fillStyle = 'white';

  // Player Paddle (Bottom)
  context.fillRect(paddleX[0], height - 20, paddleWidth, paddleHeight);

  // Computer Paddle (Top)
  context.fillRect(paddleX[1], 10, paddleWidth, paddleHeight);

  // Dashed Center Line
  context.beginPath();
  context.setLineDash([4]);
  context.moveTo(0, 350);
  context.lineTo(500, 350);
  context.strokeStyle = 'grey';
  context.stroke();

  // Ball
  context.beginPath();
  context.arc(ballX, ballY, ballRadius, 2 * Math.PI, false);
  context.fillStyle = 'white';
  context.fill();

  // Score
  context.font = '32px Courier New';
  context.fillText(score[0], 20, canvas.height / 2 + 50);
  context.fillText(score[1], 20, canvas.height / 2 - 30);
}




// Reset Ball to Center
function ballReset() {
  ballX = width / 2;
  ballY = height / 2;
  speedY = -3;
  paddleContact = false;
  socket.emit('ballMove', {
    ballX,
    ballY,
    score,
  });
}

// Adjust Ball Movement
function ballMove() {
  // Vertical Speed
  ballY += -speedY;
  // Horizontal Speed
  if (playerMoved && paddleContact) {
    ballX += speedX;
  }
  socket.emit('ballMove', {
    ballX,
    ballY,
    score,
  });
}

// Determine What Ball Bounces Off, Score Points, Reset Ball
function ballBoundaries() {
  // Bounce off Left Wall
  if (ballX < 0 && speedX < 0) {
    speedX = -speedX;
  }
  // Bounce off Right Wall
  if (ballX > width && speedX > 0) {
    speedX = -speedX;
  }
  // Bounce off player paddle (bottom)
  if (ballY > height - paddleDiff) {
    if (ballX > paddleX[0] && ballX < paddleX[0] + paddleWidth) {
      paddleContact = true;
      // Add Speed on Hit
      if (playerMoved) {
        speedY -= 1;
        // Max Speed
        if (speedY < -5) {
          speedY = -5;
          computerSpeed = 6;
        }
      }
      speedY = -speedY;
      trajectoryX = ballX - (paddleX[0] + paddleDiff);
      speedX = trajectoryX * 0.3;
    } else if (ballY > height) {
      // Reset Ball, add to Computer Score
      ballReset();

      score[1]++;

    }
  }
  // Bounce off computer paddle (top)
  if (ballY < paddleDiff) {
    if (ballX > paddleX[1] && ballX < paddleX[1] + paddleWidth) {
      // Add Speed on Hit
      if (playerMoved) {
        speedY += 1;
        // Max Speed
        if (speedY > 5) {
          speedY = 5;
        }
      }
      speedY = -speedY;
    } else if (ballY < 0) {
      // Reset Ball, add to Player Score
      ballReset();

      score[0]++;

    }
  }
}

// Computer Movement
function computerAI() {
  if (!isMultiplayer && playerMoved) {
    if (paddleX[1] + paddleDiff < ballX) {
      paddleX[1] += computerSpeed;
    } else {
      paddleX[1] -= computerSpeed;
    }
  }
}



function createStartScreen() {
  cleanup(); // Clean up any existing game state
  body.innerHTML = ''; // Clear body content

  const startScreen = document.createElement('div');
  startScreen.classList.add('start-screen');

  const title = document.createElement('h1');
  title.textContent = 'Welcome to Pong!';

  const subtitle = document.createElement('h2');
  subtitle.textContent = "Choose Game Mode";

  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('button-container');

  const singlePlayerBtn = document.createElement('button');
  singlePlayerBtn.textContent = 'Single Player';
  singlePlayerBtn.addEventListener('click', () => {
    startScreen.remove(); // Remove start screen
    isMultiplayer = false;
    loadGame(); // Load the game
  });

  const multiplayerBtn = document.createElement('button');
  multiplayerBtn.textContent = 'Multiplayer';
  multiplayerBtn.addEventListener('click', () => {
    startScreen.remove();
    isMultiplayer = true;// Set to multiplayer
    loadGame(); // Show intro screen and await opponent
  });

  buttonContainer.append(singlePlayerBtn, multiplayerBtn);
  startScreen.append(title, subtitle, buttonContainer);
  body.appendChild(startScreen); // Append start screen to the body
}

function showGameOverEl(winner) {
  // Hide Canvas
  canvas.hidden = true;
  // Container
  gameOverEl.textContent = '';
  gameOverEl.classList.add('game-over-container');
  // Title
  const title = document.createElement('h1');
  title.textContent = `${winner} Wins!`;
  // Button
  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('button-container');

  const playAgainBtn = document.createElement('button');
  playAgainBtn.textContent = 'Play Again';
  playAgainBtn.addEventListener('click', () => {
    startGame(); // Show start screen again
  })

  const mainMenuBtn = document.createElement('button');
  mainMenuBtn.textContent = 'Main Menu';
  mainMenuBtn.addEventListener('click', () => {
    gameOverEl.remove();
    if (isMultiplayer) {
      socket.disconnect();
    }
    cleanup();
    createStartScreen();
  });

  // Append
  buttonContainer.append(playAgainBtn, mainMenuBtn);
  gameOverEl.append(title, buttonContainer);
  body.appendChild(gameOverEl);

}

// Check If One Player Has Winning Score, If They Do, End Game
function gameOver() {
  if (score[0] === winningScore || score[1] === winningScore) {
    isGameOver = true;
    // Set Winner
    const winner = score[0] === winningScore ? "Player 1" : isMultiplayer ? "Player 2" : "Computer";
    showGameOverEl(winner);
  }
}

// Called Every Frame
function animate() {
  if (isMultiplayer && isReferee) {
    ballMove();
    ballBoundaries();
  } else if (!isMultiplayer) {
    ballMove();
    ballBoundaries();
  }
  renderCanvas();
  computerAI();
  gameOver();
  if (!isGameOver) {
    window.requestAnimationFrame(animate);
  }
}


//Load game
function loadGame() {
  // Show canvas if it exists, create it if it doesn't
  if (!document.body.contains(canvas)) {
    createCanvas(); // Create and append the canvas to the document
  } else {
    canvas.hidden = false;
  }

  if (isMultiplayer) {
    renderIntro(); // Render the intro text for multiplayer mode
    socket.emit('ready', {}); // Notify server that the player is ready
    console.log(`${socket.id} Ready!`);

    socket.on('connect', () => {
      console.log('Connected as...', socket.id);

    })

    socket.on('playerCount', (count) => {
      playersReady = count;
      if (playersReady === 2) {
        gameStarted = true;
      }
    });

    //Listen for when the game is ready to start
    socket.on('startGame', (refereeId) => {
      console.log('Referee is', refereeId);
      isReferee = socket.id === refereeId;
      startGame();
    });

    socket.on('paddleMove', (paddleData) => {
      // Toggle 1 into 0, and vice versa
      const opponentPaddleIndex = 1 - paddleIndex;
      paddleX[opponentPaddleIndex] = paddleData.xPosition;
    });

    socket.on('ballMove', (ballData) => {
      ({ ballX, ballY, score } = ballData);
    })

  } else {
    startGame(); // Directly start the single-player game
  }
}


// Start Game, Reset Everything
function startGame() {
  if (isGameOver && !isNewGame) {
    if (gameOverEl.parentNode) {
      gameOverEl.parentNode.removeChild(gameOverEl);
    }
    canvas.hidden = false;
  }

  // Ensure single-player paddle is always bottom
  if (!isMultiplayer) {
    paddleIndex = 0;
  } else {
    paddleIndex = isReferee ? 0 : 1;
  }

  isGameOver = false;
  isNewGame = false;
  score = [0, 0];
  ballReset();

  // Add event listener using the separate handler function
  canvas.addEventListener('mousemove', handleMouseMove);

  window.requestAnimationFrame(animate);
}

// On Load
// startGame();
createStartScreen();




