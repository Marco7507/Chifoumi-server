const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

const games = {};

io.on("connection", (socket) => {
  //console.log("new connection", socket.id);

  let gameId = null;
  let user = {
    id: "",
    name: "",
  }

  function sendGameUpdate() {
    const game = games[gameId];
    //console.log("send update game", game)
    console.log("emit to gameId", gameId)
    io.to(gameId).emit("game update", game);
  }

  function checkResult() {
    const game = games[gameId];
    const player1 = game.players[0];
    const player2 = game.players[1];

    console.log(player1.choice, player2.choice)

    if (!player1.choice || !player2.choice) {
      return;
    }

    if (player1.choice === player2.choice) {
      game.result = "draw";
    } else if (
      (player1.choice === "rock" && player2.choice === "scissors") ||
      (player1.choice === "paper" && player2.choice === "rock") ||
      (player1.choice === "scissors" && player2.choice === "paper")
    ) {
      game.result = player1.id;
      player1.score++;
    } else {
      game.result = player2.id;
      player2.score++;
    }

    sendGameUpdate();
  }

  function getGameUser() {
    // console.log("games[gameId]?.players", games[gameId]?.players)
    // console.log("result", games[gameId]?.players.find((p) => p.id === user.id))
    return games[gameId]?.players.find((p) => p.id === user.id)
  }

  socket.on("ping", () => {
    console.log("get user", getGameUser())
  });

  socket.on("connect user", (id, name) => {
    console.log("connect user", id, name)
    if (!id) {
      id = generateUserId();
    }
    if (!name) {
      name = `Player-${id}`
    } 
    user = {
      id,
      name
    }
    socket.emit("connected", user);
  })

  socket.on("create game", () => {
    console.log("user", user)
    if (!user.id || !user.name) {
      socket.emit("user not found");
      return;
    }
    gameId = generateGameId();
    games[gameId] = {
      players: [
        {
          id: user.id,
          name: user.name,
          score: 0,
          choice: null,
          role: "host",
          socketId: socket.id,
        }
      ],
      result: null,
    };
    socket.join(gameId);
    socket.emit("game created", gameId);
  });

  socket.on("join game", (newGameId) => {
    const game = games[newGameId];
    gameId = newGameId;

    if (!game) {
      socket.emit("game not found");
      return;
    }
    const player = getGameUser();
    if (!player) {
      if (game.players.length >= 2) {
        socket.emit("game full");
        return;
      }
      game.players.push({
        id: user.id,
        name: user.name,
        score: 0,
        choice: null,
        role: "guest",
        socketId: socket.id,
      });
    } else {
      player.socketId = socket.id;
    }
    
    socket.join(gameId);
    socket.emit("game joined", games[gameId]);
    sendGameUpdate();
  });

  socket.on("set choice", (choice) => {
    const game = games[gameId];
    if (!game) {
      socket.emit("game not found");
      return;
    }
    getGameUser().choice = choice;
    if (choice) {
      checkResult();
    }
  });

  socket.on("continue", () => {
    console.log("continue")
    const game = games[gameId];
    if (!game) {
      socket.emit("game not found");
      return;
    }
    game.result = null;
    game.players.forEach(player => {
      player.choice = null;
    });
    sendGameUpdate();
  });

  socket.on("reset", () => {
    const game = games[gameId];
    if (!game) {
      socket.emit("game not found");
      return;
    }
    game.result = null;
    game.players.forEach(player => {
      player.choice = null;
      player.score = 0;
    });
    sendGameUpdate();
  });
});

// Fonction pour générer un ID de partie unique
function generateGameId() {
  return Math.random().toString(16).slice(2, 6).toUpperCase();
}

function generateUserId() {
  return Math.random().toString(16).slice(2, 10).toUpperCase();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});
