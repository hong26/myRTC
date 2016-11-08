var express = require('express')
var http = require('http')
var app = express()

var port = process.env.PORT || 1919

app.use('/build', express.static('build'))
app.use('/src', express.static('src'))
app.use('/images', express.static('images'))
app.use('/views', express.static('views'))

app.get('/webrtc', (req, res) => {
	res.sendFile(__dirname+'/views/webrtc.html')
})

app.get('/webrtcvideo',(req,res)=>{
  res.sendFile(__dirname+'/views/webrtc-video.html')
})

app.get('*', (req, res) => {
	res.sendFile(__dirname+'/index.html')
})

var server = http.createServer(app)
var rooms = {}

var io = require('socket.io')(server)
io.sockets.on('connection', function(socket) {
    socket.on('enter', function(roomname) {
        socket.roomname = roomname
        if(!rooms[roomname]){
          rooms[roomname] = []
        }
        socket.join(roomname);
    });

    socket.on('message', function(message) {
        message.from = socket.id;
        var target = message.sendto;
        if(message.type === 'login'){
          var roomname = socket.roomname;
          var name = message.name;
          var obj={}
          obj.name = name
          obj.id = socket.id
          if(rooms[roomname] != 0){
            var len = rooms[roomname].length
            if(len===8){
              io.sockets.connected[socket.id].emit('message', {type: 'upperLimit'})
              return
            }
            for(var i=0; i<len; i++){
              if(rooms[roomname][i].name === name){
                io.sockets.connected[socket.id].emit('message', {type: 'duplicate'})
                return
              }
            }
            rooms[roomname].push(obj);
            io.sockets.connected[socket.id].emit('message', {type: 'users', users: rooms[roomname]});
          }else{
            rooms[roomname].push(obj);
            io.sockets.connected[socket.id].emit('message', {type: 'users', users: rooms[roomname]});
          }
          console.log(rooms)
          return
        }
        if (target) {
            io.sockets.connected[target].emit('message', message);
            return;
        }else{
           emitMessage('message', message);
           return
        }
    });

    function emitMessage(type, message) {
        var roomname=socket.roomname;

        if (roomname) {
            socket.broadcast.to(roomname).emit(type, message);
        }
        else {
            socket.broadcast.emit(type, message);
        }
    }
    socket.on('disconnect', function() {
        emitMessage('message', {type: 'disconnect', from: socket.id});
        var roomname=socket.roomname;
        if(rooms[roomname]){
          var len = rooms[roomname].length
          for(var i=0; i<len; i++){
            if(rooms[roomname][i].id === socket.id){
              rooms[roomname].splice(i, 1)
              if(rooms[roomname] == 0){
                delete rooms[roomname]
              }
              console.log(rooms)
              return
            }
          }
        }
    });
});
server.listen(port, console.info(`your app is running on ${port}`))
