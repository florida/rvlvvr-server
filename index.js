'use strict';

var Hapi = require('hapi');
var nconf = require('nconf');
var SocketIO = require('socket.io');

var services = require('./lib/services');

nconf.argv().env().file({ file: 'local.json' });

var options = {
  views: {
    engines: {
      jade: require('jade')
    },
    isCached: process.env.node === 'production',
    path: __dirname + '/views',
    compileOptions: {
      pretty: true
    }
  },
  cors: true
};

var server = Hapi.createServer(nconf.get('domain'), nconf.get('port'), options);

var routes = [
  {
    method: 'GET',
    path: '/',
    config: {
      handler: home
    }
  },
  {
    method: 'GET',
    path: '/feed',
    config: {
      handler: dashboard
    }
  },
  {
    method: 'GET',
    path: '/recent/{key}',
    config: {
      handler: dual
    }
  }
];

server.route(routes);

server.route({
  path: '/{path*}',
  method: "GET",
  config: {
    handler: {
      directory: {
        path: './dist',
        listing: false,
        index: false
      }
    }
  }
});

server.start(function () {
  var io = SocketIO.listen(server.listener);

  io.on('connection', function (socket) {
    socket.on('join', function (user) {
      //socket.disconnect();
      console.log('client connected');
      console.log(socket.rooms)
      socket.join(user);
    });

    socket.on('disconnect', function () {
      console.log('client disconnected');
    });

    socket.on('feed', function () {
      services.recent(socket);
    });

    socket.on('dual', function (data) {
      services.recentByKey(data, socket);
    });

    socket.on('message', function (data) {
      console.log('incoming data ', data)

      services.addMessage(data, function (err, message) {
        if (err) {
          console.log('error ', err);
        } else {
          var keyName = [message.sender, message.receiver].sort().join('-');
          io.sockets.to(keyName).emit('message', message);

          if (data.public) {
            io.emit('feed', message);
          }
        }
      });
    });
  });
});

function home(request, reply) {
  reply.view('index', {
    url: nconf.get('url'),
    pageType: 'home'
  });
}

function dashboard(request, reply) {
  reply.view('dashboard', {
    pageType: 'feed'
  });
}

function dual(request, reply) {
  reply.view('dual', {
    key: request.params.key,
    pageType: 'dual'
  });
}
