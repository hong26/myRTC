var styles = require('./styles/index.styl')

var roomInput = document.getElementById('room-input')
var roomButton = document.getElementById('room-button')
var roomCopy = document.getElementById('room-copy')

roomButton.addEventListener('click', (e) => {
  var value = roomInput.value
  window.location.href = '/webrtc?'+value
})

new Clipboard('.btn', {
    text: function() {
        var value = roomInput.value
        return window.location.href + 'webrtc?' + value
    }
});

roomCopy.addEventListener('click', (e)=>{
  alert('复制完成,赶快把链接分享给你的小伙伴一起视频聊天吧!')
})
