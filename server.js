const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());

app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

// Structure de données pour les parties en cours
const games = {};

io.on('connection', (socket) => {
  console.log('Un joueur s\'est connecté', socket.id);

  socket.on('ping', () => {
    console.log('pong');
    socket.emit('pong');
  });

  // Gérer la création de parties
  socket.on('createGame', () => {
    const gameId = generateGameId();
    games[gameId] = {
      players: [socket.id],
      choices: {},
    };
    socket.join(gameId);
    socket.emit('gameCreated', gameId);
  });

  // Gérer la rejoindre de parties
  socket.on('joinGame', (gameId) => {
    if (games[gameId] && games[gameId].players.length < 2) {
      games[gameId].players.push(socket.id);
      socket.join(gameId);
      socket.emit('gameJoined', gameId);
    } else {
      socket.emit('gameFull');
    }
  });

  // Gérer les choix des joueurs
  socket.on('makeChoice', (data) => {
    const { gameId, choice } = data;
    games[gameId].choices[socket.id] = choice;
    if (Object.keys(games[gameId].choices).length === 2) {
      // Les deux joueurs ont fait leur choix, déterminer le gagnant
      const player1Choice = games[gameId].choices[games[gameId].players[0]];
      const player2Choice = games[gameId].choices[games[gameId].players[1]];
      const winner = determineWinner(player1Choice, player2Choice);
      io.to(gameId).emit('gameResult', winner);
    }
  });

  // Gérer la déconnexion d'un joueur
  socket.on('disconnect', () => {
    for (const gameId in games) {
      const index = games[gameId].players.indexOf(socket.id);
      if (index !== -1) {
        games[gameId].players.splice(index, 1);
        delete games[gameId].choices[socket.id];
        if (games[gameId].players.length === 0) {
          // Supprimer la partie si plus aucun joueur
          delete games[gameId];
        }
        break;
      }
    }
  });
});

// Fonction pour générer un ID de partie unique
function generateGameId() {
  return Math.random().toString(16).slice(2, 6).toUpperCase();
}

// Fonction pour déterminer le gagnant
function determineWinner(player1Choice, player2Choice) {
  // Mettez ici votre logique pour déterminer le gagnant
  // Par exemple, comparaison de choix et retour du résultat
  // Retournez "Player 1", "Player 2" ou "Tie" selon le résultat.
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});
