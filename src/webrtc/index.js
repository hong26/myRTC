require('../styles/webrtc.styl')
// import moment from 'moment'
// moment.locale('zh-cn')

function moment(){
  const newDate = new Date()
  const hours = newDate.getHours()
  const minutes = newDate.getMinutes()
  const seconds = newDate.getSeconds()
  return (hours<10 ? '0' + hours : hours)+':'+(minutes<10 ? '0' + minutes : minutes)+':'+(seconds<10 ? '0' + seconds : seconds)
}

var URL = (window.URL || window.webkitURL || window.msURL || window.oURL);
var RTCPeerConnection = (window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
var RTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate);
var nativeRTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription);

var socketReady = false;
var socket = io.connect(window.location.href.split('/webrtc')[0] + '/');
socket.on('connect', onOpened).on('message', onMessage)
function onOpened(evt) {
    console.log('已建立socket连接');
    socketReady = true;
    var roomname = getRoomName(); //获取会议室名
    socket.emit('enter', roomname);
    var loginServer = document.getElementById('login-server')
    var loginBox = document.getElementById('login-box')
    loginServer.style.display = 'none'
    loginBox.style.display = 'block'
    console.log('进入房间' + roomname);
}

function getRoomName() {
    var url = document.location.href;

    var args = url.split('?');
    if (args.length > 1) {
        var room = args[1];
        if (room != "") {
            return room;
        }
    }
    return "defaultroom";
}

function listRendering(list){
  var usersList = document.getElementById('users-list')
  usersList.innerHTML = ''
  var len = list.length
  for(var j=0; j<len; j++){
    var p = document.createElement('p')
    p.style.marginLeft = '0.5em'
    p.style.fontWeight = 900
    if(list[j].name===myUser) p.style.color = 'green'
    p.innerText = list[j].name
    usersList.appendChild(p)
  }
}

function onMessage(evt){
  // console.log(evt)
  switch(evt.type){
    case 'upperLimit':
      alert('该房间已经达到最大连接数了!')
      break
    case 'duplicate':
      alert('用户名重复了!')
      document.getElementById('login-user-button').disabled = false
      break
    case 'users':
      var login = document.getElementById('login')
      login.style.display = 'none'
      roomUsers = evt.users
      var len = roomUsers.length
      var usersList = document.getElementById('users-list')
      usersList.innerHTML = ''
      for(var i=0; i<len; i++){
        var p = document.createElement('p')
        p.style.marginLeft = '0.5em'
        p.style.fontWeight = 900
        if(roomUsers[i].name===myUser) p.style.color = 'green'
        p.innerText = roomUsers[i].name
        usersList.appendChild(p)
        if(roomUsers[i].name !== myUser){
          socket.send({type: "response", sendto: roomUsers[i].id, name: myUser});
        }
      }
      document.getElementById('login-user-button').disabled = false
      break
      case 'response':
        let id = evt.from
        let obj = {}
        obj.id = id
        obj.name = evt.name
        roomUsers.push(obj)
        listRendering(roomUsers)
        sendOffer(id)
        break
      case 'offer':
        onOffer(evt)
        break
      case 'answer':
        onAnswer(evt)
        break
      case 'candidate':
        onCandidate(evt);
        break
      case 'disconnect':
        if(roomUsers){
          var len = roomUsers.length
            for(var i=0; i<len; i++){
              if(roomUsers[i].id === evt.from){
                if(roomUsers[i].conn.peerconnection){
                  roomUsers[i].conn.peerconnection.close();
                }
                roomUsers.splice(i, 1)
                listRendering(roomUsers)
                return
              }
            }
          }
        break
  }
}

function onOffer(evt) {
    // console.log("接收到offer...")
    // console.log(evt);
    setOffer(evt);
    sendAnswer(evt);
}

function onAnswer(evt) {
    // console.log("接收到Answer...")
    // console.log(evt);
    setAnswer(evt);
}

function onCandidate(evt) {
    var id = evt.from;
    var conn = getConnection(id);
    if (! conn) {
        console.error('peerConnection不存在!');
        return;
    }

    if (! conn.iceReady) {
        console.warn("ice尚未准备好");
        return;
    }
    var candidate = new RTCIceCandidate(evt);
    // console.log("接收到候选者...")
    // console.log(candidate);
    conn.peerconnection.addIceCandidate(candidate);
    // console.log("peerIdentity");
    // console.log(conn.peerconnection);
}

var myUser
var roomUsers
var loginUserButton = document.getElementById('login-user-button')
loginUserButton.addEventListener('click', (e) => {
  loginUserButton.disabled = true
  var loginUser = document.getElementById('login-user')
  var value = loginUser.value
  if(!!value){
    myUser = value
    socket.send({type: 'login', name: myUser})
    if(Notification && Notification.permission !== "granted"){
      Notification.requestPermission(function(status){
        if(Notification.permission !== status){
            Notification.permission = status;
        }
      });
    }
  }else{
    alert('请为自己起一个有b格的用户名吧!')
    loginUserButton.disabled = false
  }
})

function Connection(){}

function addConnection(id, connection) {
  let len = roomUsers.length
  for(let i=0; i<len; i++){
    if(roomUsers[i].id===id){
      roomUsers[i].conn = connection
    }
  }
}

function getConnection(id) {
  let conn = null
  let len = roomUsers.length
  for(let i=0; i<len; i++){
    if(roomUsers[i].id===id){
      conn = roomUsers[i].conn
    }
  }
  return conn;
}

function onCandidate(evt) {
    var id = evt.from;
    var conn = getConnection(id);
    if (! conn) {
        console.error('peerConnection不存在!');
        return;
    }

    if (! conn.iceReady) {
        console.warn("ice尚未准备好");
        return;
    }
    var candidate = new RTCIceCandidate(evt);
    // console.log("接收到候选者...")
    // console.log(candidate);
    conn.peerconnection.addIceCandidate(candidate);
    // console.log("peerIdentity");
    // console.log(conn.peerconnection);
}

function sendCandidate(candidate) {
    //通过socket发送
    socket.send(candidate);
}

function prepareNewConnection(id) {
    var conn = new Connection();
    var pc_config = {"iceServers": [{"url": "stun:stun.wirlab.net"}, {"url": "stun:stun.voipbuster.com"}, {"url": "stun:203.183.172.196"}]};
    try {
        conn.peerconnection = new RTCPeerConnection(pc_config);
    } catch (e) {
        console.log("建立连接失败，错误：" + e.message);
    }
    conn.id = id;
    let peer = conn.peerconnection
    peer.id = id
    addConnection(id, conn);
//对等端会接收到datachannel事件,发起端不会触发此事件
    peer.ondatachannel = function(evt){
      let channel = evt.channel
      setChannelEvents(channel, id)
    }
        //发送所有ICE候选者给对方
    peer.onicecandidate = function (evt) {
        if (evt.candidate) {
            // console.log(evt.candidate);
            //发送ice候选者
            sendCandidate({type: "candidate",
                        "sendto": conn.id,
                        "label": evt.candidate.sdpMLineIndex,
                        "candidate": evt.candidate.candidate});
        } else {
            conn.established = true;
        }
    };
    return conn;
}

var dataChannels = {}
function createDataChannel(conn){
  let peer = conn.peerconnection
  let id = conn.id
  let channel = peer.createDataChannel('dataChannel', {reliable: true,  ordered: true,})
  return setChannelEvents(channel, id)
}

function sendSDP(sdp, id) {
    let obj = {}
    obj.sdp = sdp
    obj.type = sdp.type
    obj.sendto = id
    //通过socket发送
    socket.send(obj);
}

function setChannelEvents(channel, id){
  let youName;
  channel.onopen=function(){
    channel.send(JSON.stringify({type: 'open',name: myUser, data: '已连接'}))
  }
  channel.onmessage = function(event){
    try{
       let message = JSON.parse(event.data)
      // console.log(message)
       switch(message.type){
         case 'open':
           youName = message.name
           let li = document.createElement('li')
           li.style.cssText = 'color:blue; margin-top:0.3em; margin-left: 0.5em; list-style: none; margin-bottom: 0.5em'
           li.innerText = `${message.name}进入房间`
           msg.appendChild(li)
           msg.scrollTop = msg.scrollHeight
           break
         case 'msg':
           displaysmsg(message)
           break
         case 'notice':
           newNotification(message.name, message.data)
           break
         case 'openvideo':
           let link = document.createElement('li')
           link.style.cssText = 'color:blue; margin-top:0.3em; list-style: none; margin-bottom: 0.5em; text-align: center'
           link.innerHTML = `<a href='${message.href}' target='_blank' style='color:blue'>${message.name}: 发起了视频聊天</a>`
           msg.appendChild(link)
           msg.scrollTop = msg.scrollHeight
           break
         case 'start':
           currentFile = [];
           currentFileSize = 0;
           currentFileMeta = message.data;
           break;
         case 'end':
           saveFile(currentFileMeta, currentFile, message.username);
           break;
      }
    }catch(e){
      currentFile.push(atob(event.data));
    }
  }
  channel.onclose = function(event){
    let li = document.createElement('li')
    li.style.cssText = 'color:blue; list-style:none; margin-left:0.5em; margin-top:1em'
    li.innerText = `${youName}离开房间`
    msg.appendChild(li)
    msg.scrollTop = msg.scrollHeight
    delete dataChannels[id]
  }
  dataChannels[id] = channel
  // return channel
}

var msg = document.getElementById('msg')
msg.innerHTML = ''

var textTextarea = document.getElementById('text-textarea')
var textSend = document.getElementById('text-send')
var textColor = document.getElementById('text-color')
var clearMsg = document.getElementById('clear-msg')

textSend.addEventListener('click', send)
clearMsg.addEventListener('click', () => {
  msg.innerHTML = ''
})
textTextarea.addEventListener('keyup', (e) => {
  if(e.keyCode === 13 && roomUsers.length>1){
    send()
  }
})
document.getElementById('text-file-button').addEventListener('click', () => {
  let evt = document.createEvent("MouseEvents");
  evt.initEvent("click", false, true);
  inputFile.dispatchEvent(evt);
})

function displaysmsg(evt, my){
    // let date = new Date()
    let liTitle = document.createElement('li')
    // liTitle.innerText = `${evt.name}  ${moment(date).format("HH:mm:ss")}`
    liTitle.innerText = `${evt.name}  ${moment()}`
    liTitle.style.cssText = 'margin-left: 0.5em; list-style: none'
    liTitle.style.color = my ? 'green' : 'blue'
    let liText = document.createElement('li')
    liText.innerHTML = showEmoji(evt.data)
    liText.style.cssText = 'margin-top:0.3em; margin-left: 0.5em; list-style: none; margin-bottom: 0.5em'
    liText.style.color = evt.color
    msg.appendChild(liTitle)
    msg.appendChild(liText)
    msg.scrollTop = msg.scrollHeight
}

function send(){
  let value = textTextarea.value
  let color = textColor.value
  if(value && roomUsers.length>1 && value.trim().length != 0){
    let obj={}
    for(let id in dataChannels){
      obj.type = 'msg'
      obj.data = value
      obj.name = myUser
      obj.color = color
      dataChannels[id].send(JSON.stringify(obj))
    }
    displaysmsg(obj, true)
    textTextarea.value = ''
  }
}


var currentFile, currentFileSize, currentFileMeta, fileName;
var CHUNK_MAX = 16000;

function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[i] );
    }
    return btoa(binary);
}

function base64ToBlob(b64Data, contentType) {
    contentType = contentType || '';

    var byteArrays = [], byteNumbers, slice;

    for (var i = 0; i < b64Data.length; i++) {
      slice = b64Data[i];

      byteNumbers = new Array(slice.length);
      for (var n = 0; n < slice.length; n++) {
          byteNumbers[n] = slice.charCodeAt(n);
      }

      var byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }

    var blob = new Blob(byteArrays, {type: contentType});
    return blob;
}

var inputFile = document.getElementById('text-file')
inputFile.addEventListener('change',function(){
  var file = this.files[0]
  var that = this
  fileName=file.name;

  //把文件url化
  var reader = new FileReader();

  reader.onloadend = function(evt) {
    inputFile.disabled = true
    if (evt.target.readyState == FileReader.DONE && window.confirm('是否向房间里的所有用户发送文件:'+fileName)) {
      let obj = {}
      obj.name = file.name
      obj.size = file.size
      obj.type = file.type
      for(var id in dataChannels){
        dataChannels[id].send(JSON.stringify({type: "start", data: obj}));
      }

      var buffer = reader.result,
          start = 0,
          end = 0,
          last = false;

      function sendChunk() {
        end = start + CHUNK_MAX;

        if (end > file.size) {
          end = file.size;
          last = true;
        }
        for(var id in dataChannels){
          dataChannels[id].send(arrayBufferToBase64(buffer.slice(start, end)));
        }

        if (last === true) {
          for(var id in dataChannels){
            dataChannels[id].send(JSON.stringify({ type: "end", username: myUser}));
          }
          // let date = new Date()
          let liText = document.createElement('li')
          // liText.innerText = `文件: ${fileName}  于${moment(date).format("HH:mm:ss")}上传成功`
          liText.innerText = `文件: ${fileName}  于${moment()}上传成功`
          liText.style.cssText = 'margin-top:0.3em; margin-left: 0.5em; list-style: none; margin-bottom: 0.5em'
          liText.style.color = 'green'
          msg.appendChild(liText)
          msg.scrollTop = msg.scrollHeight
          inputFile.disabled = false
        } else {
          start = end;
          setTimeout(function () {
            sendChunk();
          }, 100);
        }
      }
      sendChunk();
    }else{
      inputFile.value=''
      inputFile.disabled = false
    }
  };
  reader.readAsArrayBuffer(file);
})

function saveFile(meta, data, name) {
  var li = document.createElement('li')
  li.innerText = `${name}分享了文件: `
  li.style.cssText = 'margin-top:0.3em; margin-left: 0.5em; list-style: none; margin-bottom: 0.5em'
  var blob = base64ToBlob(data, meta.type);

  var link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = meta.name;
  link.innerText = meta.name;
  li.appendChild(link)
  msg.appendChild(li)
  msg.scrollTop = msg.scrollHeight
}

function initialEmoji() {
        var emojiContainer = document.getElementById('emojiWrapper'),
            docFragment = document.createDocumentFragment();
        for (var i = 70; i > 0; i--) {
            var emojiItem = document.createElement('img');
            emojiItem.src = '/images/emoji/' + i + '.gif';
            emojiItem.style.cssText = 'height: 2em; width: 2em; padding: 0.1em'
            emojiItem.title = i;
            docFragment.appendChild(emojiItem);
        };
        emojiContainer.appendChild(docFragment);
}

initialEmoji()

document.getElementById('emoji').addEventListener('click', function(e) {
    var emojiwrapper = document.getElementById('emojiWrapper');
    emojiwrapper.style.display = 'block';
    e.stopPropagation();
}, false);

document.body.addEventListener('click', function(e) {
    var emojiwrapper = document.getElementById('emojiWrapper');
    if (e.target != emojiwrapper) {
        emojiwrapper.style.display = 'none';
    };
});

document.getElementById('emojiWrapper').addEventListener('click', function(e){
  var target = e.target
  if(target.nodeName.toLowerCase() == 'img'){
    textTextarea.focus()
    textTextarea.value = `${textTextarea.value}[emoji:${target.title}]`
  }
})

function showEmoji(msg) {
  var match, result = msg,
    reg = /\[emoji:\d+\]/g,
    emojiIndex,
    totalEmojiNum = document.getElementById('emojiWrapper').children.length;
    // console.log(msg)
    // reg.exec(msg)
    // console.log(msg)
  while (match = reg.exec(msg)) {
    emojiIndex = match[0].slice(7, -1);
    if (emojiIndex > totalEmojiNum) {
      result = result.replace(match[0], '[X]');
    } else {
      result = result.replace(match[0], '<img class="emoji" src="images/emoji/' + emojiIndex + '.gif" />');
    };
  };
  return result;
}

function newNotification(title, body, icon) {
  var options={
    dir: "ltr",
    lang: "utf-8",
    icon:  icon || '/images/bg.jpg' ,
    body: body
  };
  if(Notification && Notification.permission === "granted"){
    var n = new Notification(title, options)
    n.onshow = function(){
      setTimeout(function(){
        n.close()
      }, 3000)
    }
  }else{
    return
  }
}

document.getElementById('notice').addEventListener('click', function(){
  let value = textTextarea.value
  if(roomUsers.length>1 && value.trim().length != 0){
    let obj={}
    for(let id in dataChannels){
      obj.type = 'notice'
      obj.data = value
      obj.name = myUser
      dataChannels[id].send(JSON.stringify(obj))
    }
    newNotification(myUser, value)
    textTextarea.value = ''
  }
})

document.getElementById('open-video').addEventListener('click', (e) => {
  if(roomUsers.length>1){
    let obj = {}
    let href = '/webrtcvideo?'+getRoomName()
    for(let id in dataChannels){
      obj.type = 'openvideo'
      obj.href = href
      obj.name = myUser
      dataChannels[id].send(JSON.stringify(obj))
    }
    let link = document.createElement('a')
    link.href = href
    link.target = '_blank'
    let evt = document.createEvent('MouseEvent')
    evt.initEvent("click", true, true);
    //把鼠标点击事件绑定到a标签上(此时已经触发点击事件)
    link.dispatchEvent(evt);
  }else{
    return
  }
})

function sendOffer(id) {
    var conn = prepareNewConnection(id);
    createDataChannel(conn)
    conn.peerconnection.createOffer(function (sessionDescription) {
        conn.iceReady = true;
        conn.peerconnection.setLocalDescription(sessionDescription);
        //发送sdp
        sendSDP(sessionDescription,id);
    }, function () {
        console.log("创建Offer失败");
    });
    conn.iceReady = true;
}

function setOffer(evt) {
    var id = evt.from;
    var sdp = evt.sdp
    var conn = prepareNewConnection(id);
    conn.peerconnection.setRemoteDescription(new nativeRTCSessionDescription(sdp));
}

function sendAnswer(evt) {
    // console.log('发送Answer,创建远程会话描述...' );
    var id = evt.from;
    var conn = getConnection(id);
    if (!conn) {
        console.error('peerConnection不存在!');
        return
    }

    conn.peerconnection.createAnswer(function (sessionDescription) {
        conn.iceReady = true;
        conn.peerconnection.setLocalDescription(sessionDescription);
        sendSDP(sessionDescription, id);
    }, function () {
        console.log("创建Answer失败");
    });
    conn.iceReady = true;
}

function setAnswer(evt) {
    var id = evt.from;
    var sdp = evt.sdp
    var conn = getConnection(id);
    if (! conn) {
        console.error('peerConnection不存在!');
        return
    }
    conn.peerconnection.setRemoteDescription(new nativeRTCSessionDescription(sdp));
}
