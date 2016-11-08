var styles = require('../styles/webrtc.styl')

var getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
var URL = (window.URL || window.webkitURL || window.msURL || window.oURL);
var RTCPeerConnection = (window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
var RTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate);
var nativeRTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription);

document.getElementById('startvideo').addEventListener('click', startVideo, false)
document.getElementById('stopvideo').addEventListener('click', stopVideo, false)
document.getElementById('call').addEventListener('click', call, false)
document.getElementById('hangup').addEventListener('click', hangUp, false)

var localVideo = document.getElementById('local-video');
var localStream = null;
var mediaConstraints = {'mandatory': {'OfferToReceiveAudio':false, 'OfferToReceiveVideo':true }};

var videoElementsInUse = {};   //已经使用的元素
var videoElementsStandBy = [];  //空闲元素
pushVideoStandBy(getVideoForRemote(2));
pushVideoStandBy(getVideoForRemote(1));
pushVideoStandBy(getVideoForRemote(0));
//提取
function getVideoForRemote(index) {
    var elementID = 'remote-video-' + index;
    var element = document.getElementById(elementID);
    return element;
}

// ---- video元素管理 --- 提取
function pushVideoStandBy(element) {
    videoElementsStandBy.unshift(element)
}

//从数组移除元素(当使用结束后需要移除得到空闲元素),返回被移除的元素
function popVideoStandBy() {
    var element = null;
    if(videoElementsStandBy.lenght!=0){
      element=videoElementsStandBy[0]
      videoElementsStandBy.splice(0,1)
      return element
    }
    return null
}

//添加正在使用元素
function pushVideoInUse(id, element) {
    videoElementsInUse[id] = element;
}

//移除正在使用的元素
function popVideoInUse(id) {
    var element = null;
    element = videoElementsInUse[id];
    delete videoElementsInUse[id];
    return element;
}
//添加视频
function attachVideo(id, stream) {
    // console.log('尝试添加video. id=' + id);
    var videoElement = popVideoStandBy();
    if (videoElement) {
       if (navigator.mozGetUserMedia) {
            videoElement.mozSrcObject = stream;
            videoElement.play();
        } else {
            videoElement.src = URL.createObjectURL(stream);
        }
        // console.log("videoElement.src=" + videoElement.src);
        pushVideoInUse(id, videoElement);
        let msgs = document.getElementById('msgs')
        let li = document.createElement('li')
        li.style.listStyle = 'none'
        li.style.color = 'blue'
        li.innerText = JudgeTheUser(id) + '加入房间'
        msgs.appendChild(li)
        msgs.scrollTop = msgs.scrollHeight
        // console.log(videoElementsInUse)
    }
    else {
        console.error('---没有可用的video元素');
    }
}

//移除已链接用户
function detachVideo(id) {
    console.log('尝试移除video. id=' + id);
    var videoElement = popVideoInUse(id);
    if (videoElement) {
        videoElement.pause();
        videoElement.src = "";
        console.log("videoElement.src=" + videoElement.src);
        pushVideoStandBy(videoElement);
    }
    else {
        console.warn('警告 --- 没有id为'+id+'的video元素');
    }
}

//移除全部已连接用户
function detachAllVideo() {
    var element = null;
    for (var id in videoElementsInUse) {
        detachVideo(id);
    }
}

function getFirstVideoInUse() {
    var element = null;
    for (var id in videoElementsInUse) {
        element = videoElementsInUse[id];
        return element;
    }
    return null;
}

function getVideoCountInUse() {
    var count = 0;
    for (var id in videoElementsInUse) {
        count++;
    }
    return count;
}

function isLocalStreamStarted() {
    if (localStream) {
        return true;
    }
    else {
        return false;
    }
}

var MAX_CONNECTION_COUNT = 3;
var connections = {}; // 连接数组
function Connection() { // Connection类
    var self = this;
    var id = "";  // 对方的socket.id
    var peerconnection = null; //RTCPeerConnection对象实例
    var established = false; //是否已建立连接
    var iceReady = false;
}

function getConnection(id) {
    var con = null;
    con = connections[id];
    return con;
}

function addConnection(id, connection) {
    connections[id] = connection;
}

function getConnectionCount() {
    var count = 0;
    for (var id in connections) {
        count++;
    }

    console.log('getConnectionCount=' + count);
    return count;
}

function isConnectPossible() {
    if (getConnectionCount() < MAX_CONNECTION_COUNT)
        return true;
    else
        return false;
}

function getConnectionIndex(id_to_lookup) {
    var index = 0;
    for (var id in connections) {
        if (id == id_to_lookup) {
            return index;
        }
        index++;
    }
    //未找到连接
    return -1;
}

function deleteConnection(id) {
    delete connections[id];
}

function stopAllConnections() {
    for (var id in connections) {
        var conn = connections[id];
        conn.peerconnection.close();
        conn.peerconnection = null;
        delete connections[id];
    }
}

function stopConnection(id) {
    var conn = connections[id];
    if(conn) {
        // console.log('停止并删除id为'+ id+'的连接');
        conn.peerconnection.close();
        conn.peerconnection = null;
        delete connections[id];
    }
    else {
        console.log('尝试停止连接,但是没有找到id为'+ id+'的连接');
    }
}

function isPeerStarted() {
    if (getConnectionCount() > 0) {
        return true;
    }
    else {
        return false;
    }
}

// ---- socket ------
//创建socket连接
var socketReady = false;
var interruption = true;
var socket = io.connect(window.location.href.split('/webrtc')[0] + '/');

socket.on('connect', onOpened).on('message', onMessage)

function onOpened(evt) {
    console.log('已建立socket连接');
    socketReady = true;

    var roomname = getRoomName(); //获取会议室名
    socket.emit('enter', roomname);
    console.log('进入房间' + roomname);
}

//接收消息
function onMessage(evt) {
    var id = evt.from;
    var target = evt.sendto;
    var conn = getConnection(id);
    if (evt.type === 'call') {
        if (!isLocalStreamStarted()) {
            return;
        }
        if (conn) {
            return;  //已连接
        }
        if(interruption){
          return
        }
        if (isConnectPossible()) {
          //由于比第一个人慢开启信令事件,所以第一个人的'call'别人接收不到,第二个人的连接(call)会被第一个人捕获,于是第一个人发送response
            socket.json.send({type: "response", sendto: id });
            return
        }
        else {
            console.warn('已达到最大连接数，因此本连接被忽略');
        }
        return;
    }
    else if (evt.type === 'response') {
      //第二个人第二步收到response信息,发送offer和ice候选者
      //发送offer事件时sendOffer也会触发prepareNewConnection函数,发送本地媒体流,监听远程视频流
       sendOffer(id)
       return;
    } else if (evt.type === 'offer') {
      //第一个人第二步接收到offer,设置远程sdp(远程sdp,代码:conn.peerconnection.setRemoteDescription(new RTCSessionDescription(evt)))发送answer和ice候选者
      //设置offer时(setoffer)会触发prepareNewConnection函数,prepareNewConnection函数会发送本地媒体流,同时打开视频流监听事件
      //监听远程媒体流
        // console.log("接收到offer,设置offer,发送answer....")
        onOffer(evt)
    } else if (evt.type === 'answer' && isPeerStarted()) {
      //第二个人第三步接收到answer,设置远程sdp(远程sdp,代码:conn.peerconnection.setRemoteDescription(new RTCSessionDescription(evt)))
        // console.log('接收到answer,设置answer SDP');
        onAnswer(evt)
    } else if (evt.type === 'candidate' && isPeerStarted()) {
      //发送ice候选者时会触发,onCandidate添加ice候选者,ice连通后才能开始p2p通信
        // console.log('接收到ICE候选者...');
        onCandidate(evt);
    } else if (evt.type === 'bye' && !!connections[id]) {
        // console.log("WebRTC通信断开");
      onDisconnect(id, '离开房间')
    }else if(evt.type === 'disconnect' && !!connections[id]){
      onDisconnect(id, '断开连接')
    }
}

function onDisconnect(id, text){
  let msgs = document.getElementById('msgs')
  let li = document.createElement('li')
  li.style.listStyle = 'none'
  li.style.color = 'red'
  li.innerText = JudgeTheUser(id) + text
  msgs.appendChild(li)
  msgs.scrollTop = msgs.scrollHeight
  detachVideo(id);
  stopConnection(id);
  if(getConnectionCount()===0){
    textButton.disabled = true
    inputFile.disabled = true
  }
}

function getRoomName() { //例如，在URL中使用 ?roomname
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

function sendSDP(sdp, id) {
    let obj = {}
    obj.sdp = sdp
    obj.type = sdp.type
    obj.sendto = id
    //通过socket发送
    socket.json.send(obj);
}

function sendCandidate(candidate) {
    //通过socket发送
    socket.json.send(candidate);
}

function startVideo() {
    getUserMedia.call(navigator,{video: true, audio: false},
    function (stream) { // success
        localStream = stream;
        localVideo.src = URL.createObjectURL(stream);
        localVideo.play();
        localVideo.volume = 0;
    },
    function (error) {
        console.error('发生了一个错误: [错误代码： ' + error.code + ']');
        return;
    });
}

function stopVideo() {
    localVideo.src = "";
    history.go(0)
    // localStream.stop();  //失效,只能使用自动刷新解决
}

var myId
var dataChannels = {}
function prepareNewConnection(id) {
    var conn = new Connection();
    var pc_config = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}, {"url": "stun:203.183.172.196:3478"}]};
    try {
        conn.peerconnection = new RTCPeerConnection(pc_config);
    } catch (e) {
        console.log("建立连接失败，错误：" + e.message);
    }
    conn.id = id;
    let peer = conn.peerconnection
    peer.id = id
    addConnection(id, conn);
    // console.log('添加本地视频流...');
    // console.log(localStream)
    peer.addStream(localStream);
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
    peer.addEventListener("addstream", onRemoteStreamAdded, false);
    peer.addEventListener("removestream", onRemoteStreamRemoved, false)
    // peer.addEventListener("iceconnectionstatechange",onIceconnectionstatechange,false);

    //当接收到远程视频流时，使用本地video元素进行显示
    function onRemoteStreamAdded(event) {
        // console.log("Added remote stream");
        attachVideo(this.id, event.stream);
    }

    //当远程结束通信时，取消本地video元素中的显示
    function onRemoteStreamRemoved(event) {
        console.log("移除远程视频流");
        detachVideo(this.id);
    }
    // function onIceconnectionstatechange(event){
    //     if(peer.iceConnectionState=="disconnected"){
    //       let msgs = document.getElementById('msgs')
    //       let li = document.createElement('li')
    //       li.style.listStyle = 'none'
    //       li.style.color = 'red'
    //       li.innerText = JudgeTheUser(this.id) + '离开房间'
    //       msgs.appendChild(li)
    //       msgs.scrollTop = msgs.scrollHeight
    //       detachVideo(this.id);
    //       stopConnection(this.id);
    //       if(getConnectionCount()===0){
    //         textButton.disabled = true
    //       }
    //     }
    // }
    return conn;
}
var textButton = document.getElementById('text_button');
var textInput = document.getElementById('text')
textButton.addEventListener('click', (event)=>{
  let value=textInput.value
  if(isPeerStarted() && value){
    for(let id in dataChannels){
      let obj={}
      obj.type = 'msg'
      obj.data = value
      obj.id = myId
      dataChannels[id].send(JSON.stringify(obj))
    }
    let msgs = document.getElementById('msgs')
    let li = document.createElement('li')
    li.innerText = '本地用户: '+value
    li.style.color = 'green'
    li.style.listStyle = 'none'
    msgs.appendChild(li)
    msgs.scrollTop = msgs.scrollHeight
    textInput.value = ''
  }
},false)

function createDataChannel(conn){
  let peer = conn.peerconnection
  let id = conn.id
  let channel = peer.createDataChannel('dataChannel', {reliable: false})
  return setChannelEvents(channel, id)
}

function JudgeTheUser(userId){
  let videoId=videoElementsInUse[userId].id
  let id
  if(videoId==='remote-video-0'){
    id='远程用户一'
  }else if(videoId==='remote-video-1'){
    id='远程用户二'
  }else{
    id='远程用户三'
  }
  return id
}

function setChannelEvents(channel, id){
  channel.onopen=function(){
    channel.send(JSON.stringify({type:'open', myid:id, data:'已连接'}))
  }

  channel.onmessage = function(event){
    let data = JSON.parse(event.data)
    if(data.type==='open'){
      myId = data.myid
      textButton.disabled = false
      inputFile.disabled = false
    }else if(data.type==='msg'){
      let msgs = document.getElementById('msgs')
      let li = document.createElement('li')
      li.style.listStyle = 'none'
      li.innerText = JudgeTheUser(data.id) + ': ' + data.data
      msgs.appendChild(li)
      msgs.scrollTop = msgs.scrollHeight
    }else if(data.type==='filemsg'){
      let msgs = document.getElementById('msgs')
      let li = document.createElement('li')
      li.style.listStyle = 'none'
      li.style.color = 'orange'
      li.innerText = JudgeTheUser(data.id) + ': ' + data.data
      msgs.appendChild(li)
      msgs.scrollTop = msgs.scrollHeight
    }else if(data.type==='file'){
      arrayToStoreChunks.push(data.message);
      if (data.last) {
        saveToDisk(arrayToStoreChunks.join(''),data.fileName, JudgeTheUser(data.id));
        arrayToStoreChunks = [];
      }
    }
  }
  channel.onclose = function(event){
    delete dataChannels[id]
  }
  dataChannels[id] = channel
  // return channel
}

var arrayToStoreChunks = [];
var chunkLength = 16000;   //15kb左右
var dataChannel;
var fileName;
var inputFile = document.getElementById('webrtc_file')
inputFile.addEventListener('change',function(){
  var file = this.files[0]
  var that = this
  fileName=file.name;
  //把文件url化
  var reader = new window.FileReader();
  //readAsDataURL()
// 开始读取指定的Blob对象或File对象中的内容. 当读取操作完成时,readyState属性的值会成为DONE,如果设置了onloadend事件处理程序,则调用之.同时,result属性中将包含一个data: URL格式的字符串以表示所读取文件的内容.
  reader.readAsDataURL(file);
  //onload方法返回一个data: URL格式的字符串
  reader.onload = (event)=>{
    if(window.confirm('是否向房间里的所有用户发送文件:'+fileName)){
      onReadAsDataURL(event)
      inputFile.disabled = true
    }else{
      inputFile.value=''
    }
   }
})

function saveToDisk(fileUrl, fileName, id) {
  if(window.confirm('是否接收'+id+'发送的远程文件:'+fileName)){
    //创建一个a标签,该a标签点击后会在新窗口下载文件
    var save = document.createElement('a');
    save.href = fileUrl;
    save.target = '_blank';
    save.download = fileName || fileUrl;
    //创建一个鼠标点击事件
    var evt = document.createEvent("MouseEvents");
    evt.initEvent("click",true,true);
    //把鼠标点击事件绑定到a标签上(此时已经触发点击事件)
    save.dispatchEvent(evt);
    //清空下载流的url
    window.URL.revokeObjectURL(save.href);
    for(let id in dataChannels){
      let obj={}
      obj.type = 'filemsg'
      obj.data = '成功接收了文件:'+fileName
      obj.id = myId
      dataChannels[id].send(JSON.stringify(obj))
    }
  }else{
    for(let id in dataChannels){
      let obj={}
      obj.type = 'filemsg'
      obj.data = '拒绝接收文件:'+fileName
      obj.id = myId
      dataChannels[id].send(JSON.stringify(obj))
    }
    return
  }
}

function onReadAsDataURL(event, text) {
    var data = {};
    if (event) text = event.target.result;
    if (text.length > chunkLength) {
        data.type = 'file'
        data.message = text.slice(0, chunkLength);
    } else {
        data.type = 'file'
        data.message = text;
        data.last = true;
        data.id = myId
        data.fileName=fileName;
        inputFile.value = ''
        inputFile.disabled = false
        for(let id in dataChannels){
          let obj={}
          obj.type = 'filemsg'
          obj.data = '发送了文件:'+fileName
          obj.id = myId
          dataChannels[id].send(JSON.stringify(obj))
        }
    }
    for(var id in dataChannels){
      dataChannels[id].send(JSON.stringify(data));
    }
    var remainingDataURL = text.slice(data.message.length);
    if (remainingDataURL.length)
    setTimeout(function () {
        onReadAsDataURL(null, remainingDataURL);
    }, 100)
}

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
    }, mediaConstraints);
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
    }, mediaConstraints);
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

//在连接之前先呼叫其他人
function call() {
    if (! isLocalStreamStarted()) {
        alert("请先捕捉本地视频");
        return;
    }
    if (! socketReady) {
        alert("尚未与Socket服务器建立连接");
        return;
    }
    if(getConnectionCount()!==0){
      return
    }
    //呼叫同房间内的其他人
    console.log("呼叫同房间内的其他人");
    interruption = false
    socket.json.send({type: "call"});
}

//停止连接
function hangUp() {
    console.log("挂断");
    interruption = true
    socket.json.send({type: "bye"});
    detachAllVideo();
    stopAllConnections();
    textButton.disabled = true
    inputFile.disabled = true
}
