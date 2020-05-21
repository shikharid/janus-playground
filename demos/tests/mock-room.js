// We make use of this 'server' variable to provide the address of the
// REST Janus API. By default, in this example we assume that Janus is
// co-located with the web server hosting the HTML pages but listening
// on a different port (8088, the default for HTTP in Janus), which is
// why we make use of the 'window.location.hostname' base address. Since
// Janus can also do HTTPS, and considering we don't really want to make
// use of HTTP for Janus if your demos are served on HTTPS, we also rely
// on the 'window.location.protocol' prefix to build the variable, in
// particular to also change the port used to contact Janus (8088 for
// HTTP and 8089 for HTTPS, if enabled).
// In case you place Janus behind an Apache frontend (as we did on the
// online demos at http://janus.conf.meetecho.com) you can just use a
// relative path for the variable, e.g.:
//
// 		var server = "/janus";
//
// which will take care of this on its own.
//
//
// If you want to use the WebSockets frontend to Janus, instead, you'll
// have to pass a different kind of address, e.g.:
//
// 		var server = "ws://" + window.location.hostname + ":8188";
//
// Of course this assumes that support for WebSockets has been built in
// when compiling the server. WebSockets support has not been tested
// as much as the REST API, so handle with care!
//
//
// If you have multiple options available, and want to let the library
// autodetect the best way to contact your server (or pool of servers),
// you can also pass an array of servers, e.g., to provide alternative
// means of access (e.g., try WebSockets first and, if that fails, fall
// back to plain HTTP) or just have failover servers:
//
//		var server = [
//			"ws://" + window.location.hostname + ":8188",
//			"/janus"
//		];
//
// This will tell the library to try connecting to each of the servers
// in the presented order. The first working server will be used for
// the whole session.
//

var isMockRunningAPI = "https://ec2-34-236-240-62.compute-1.amazonaws.com:1443/call-running.json";
var remoteServer = "https://ec2-34-236-240-62.compute-1.amazonaws.com:8089/janus";
var server = remoteServer || (window.location.protocol === 'http:'
  ? "http://" + window.location.hostname + ":8088/janus"
  : "https://" + window.location.hostname + ":8089/janus");

var janus = null;
var sfutest = null;
var opaqueId = "videoroomtest-"+Janus.randomString(12);

var myroom = 7532;	// Demo room
var myusername = null;
var myid = null;
var mystream = null;
// We use this other ID just to map our subscriptions to us
var mypvtid = null;

var feeds = [];
var bitrateTimer = [];

var participants = 8;

function random_rgba() {
  var o = Math.round, r = Math.random, s = 255;
  return 'rgba(' + o(r()*s) + ',' + o(r()*s) + ',' + o(r()*s) + ',' + r().toFixed(1) + ')';
}

//https://blog.mozilla.org/webrtc/warm-up-with-replacetrack/
let silence = () => {
  return silenceStream().getAudioTracks()[0];
}

let silenceStream = () => {
  let ctx = new AudioContext(), oscillator = ctx.createOscillator();
  let dst = oscillator.connect(ctx.createMediaStreamDestination());
  oscillator.start();
  return dst.stream;
}

// let silence = () => {
//   var audio = document.getElementById('mock-audio');
//   audio.play();
//   setInterval(function() {
//     audio.play()
//   }, 5000);
//   let stream = audio.captureStream();
//   return stream.getAudioTracks()[0];
// }

let mockMedia = ({width = 640, height = 480} = {}) => {
  var video = document.getElementById('mock-source');
  let stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
  return stream.getVideoTracks()[0];
}

const MOCK_MEDIA = {
  "enabled": true,
  "video": () => mockMedia(),
  "audio": () => silence()
};

function initJanus() {
  Janus.init({
    debug: "all", mockMedia: MOCK_MEDIA, callback: function () {
      // Use a button to start the demo
        $(this).attr('disabled', true).unbind('click');
        // Make sure the browser supports WebRTC
        if (!Janus.isWebrtcSupported()) {
          bootbox.alert("No WebRTC support... ");
          return;
        }
        // Create session
        janus = new Janus(
          {
            server: server,
            success: function () {
              // Attach to VideoRoom plugin
              janus.attach(
                {
                  plugin: "janus.plugin.videoroom",
                  opaqueId: opaqueId,
                  success: function (pluginHandle) {
                    $('#details').remove();
                    sfutest = pluginHandle;
                    Janus.log("Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")");
                    Janus.log("  -- This is a publisher/manager");
                    // Prepare the username registration
                    // Prepare the username registration
                    $('#videojoin').removeClass('hide').show();
                    $('#registernow').removeClass('hide').show();
                    $('#register').click(registerUsername);
                    $('#username').focus();
                    $('#start').removeAttr('disabled').html("Stop")
                      .click(function() {
                        $(this).attr('disabled', true);
                        janus.destroy();
                      });
                  },
                  error: function (error) {
                    Janus.error("  -- Error attaching plugin...", error);
                    bootbox.alert("Error attaching plugin... " + error);
                  },
                  consentDialog: function (on) {
                    Janus.debug("showing nothing for consent, let browser do. consent is " + (on ? "on" : "off") + " now");
                  },
                  mediaState: function (medium, on) {
                    Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                  },
                  webrtcState: function (on) {
                    Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                    $("#videolocal").parent().parent().unblock();
                    if (!on)
                      return;
                    $('#publish').remove();
                    // This controls allows us to override the global room bitrate cap
                    $('#bitrate').parent().parent().removeClass('hide').show();
                    $('#bitrate a').click(function () {
                      var id = $(this).attr("id");
                      var bitrate = parseInt(id) * 1000;
                      if (bitrate === 0) {
                        Janus.log("Not limiting bandwidth via REMB");
                      } else {
                        Janus.log("Capping bandwidth to " + bitrate + " via REMB");
                      }
                      $('#bitrateset').html($(this).html() + '<span class="caret"></span>').parent().removeClass('open');
                      sfutest.send({"message": {"request": "configure", "bitrate": bitrate}});
                      return false;
                    });
                  },
                  onmessage: function (msg, jsep) {
                    Janus.debug(" ::: Got a message (publisher) :::");
                    Janus.debug(msg);
                    var event = msg["videoroom"];
                    Janus.debug("Event: " + event);
                    if (event != undefined && event != null) {
                      if (event === "joined") {
                        // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                        myid = msg["id"];
                        mypvtid = msg["private_id"];
                        Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                        publishOwnFeed(false);
                        // Any new feed to attach to?
                        if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
                          var list = msg["publishers"];
                          Janus.debug("Got a list of available publishers/feeds:");
                          Janus.debug(list);
                          for (var f in list) {
                            var id = list[f]["id"];
                            var display = list[f]["display"];
                            var audio = list[f]["audio_codec"];
                            var video = list[f]["video_codec"];
                            Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                            newRemoteFeed(id, display, audio, video);
                          }
                        }
                      } else if (event === "destroyed") {
                        // The room has been destroyed
                        Janus.warn("The room has been destroyed!");
                        bootbox.alert("The room has been destroyed", function () {
                          window.location.reload();
                        });
                      } else if (event === "event") {
                        // Any new feed to attach to?
                        if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
                          var list = msg["publishers"];
                          Janus.debug("Got a list of available publishers/feeds:");
                          Janus.debug(list);
                          for (var f in list) {
                            var id = list[f]["id"];
                            var display = list[f]["display"];
                            var audio = list[f]["audio_codec"];
                            var video = list[f]["video_codec"];
                            Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                            newRemoteFeed(id, display, audio, video);
                          }
                        } else if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
                          // One of the publishers has gone away?
                          var leaving = msg["leaving"];
                          Janus.log("Publisher left: " + leaving);
                          var remoteFeed = null;
                          for (var i = 1; i < participants; i++) {
                            if (feeds[i] != null && feeds[i] != undefined && feeds[i].rfid == leaving) {
                              remoteFeed = feeds[i];
                              break;
                            }
                          }
                          if (remoteFeed != null) {
                            Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                            $('#remote' + remoteFeed.rfindex).empty().hide();
                            $('#videoremote' + remoteFeed.rfindex).empty();
                            feeds[remoteFeed.rfindex] = null;
                            remoteFeed.detach();
                          }
                        } else if (msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                          // One of the publishers has unpublished?
                          var unpublished = msg["unpublished"];
                          Janus.log("Publisher left: " + unpublished);
                          if (unpublished === 'ok') {
                            // That's us
                            sfutest.hangup();
                            return;
                          }
                          var remoteFeed = null;
                          for (var i = 1; i < participants; i++) {
                            if (feeds[i] != null && feeds[i] != undefined && feeds[i].rfid == unpublished) {
                              remoteFeed = feeds[i];
                              break;
                            }
                          }
                          if (remoteFeed != null) {
                            Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                            $('#remote' + remoteFeed.rfindex).empty().hide();
                            $('#videoremote' + remoteFeed.rfindex).empty();
                            feeds[remoteFeed.rfindex] = null;
                            remoteFeed.detach();
                          }
                        } else if (msg["error"] !== undefined && msg["error"] !== null) {
                          if (msg["error_code"] === 426) {
                            // This is a "no such room" error: give a more meaningful description
                            bootbox.alert(
                              "<p>Apparently room <code>" + myroom + "</code> (the one this demo uses as a test room) " +
                              "does not exist...</p><p>Do you have an updated <code>janus.plugin.videoroom.jcfg</code> " +
                              "configuration file? If not, make sure you copy the details of room <code>" + myroom + "</code> " +
                              "from that sample in your current configuration file, then restart Janus and try again."
                            );
                          } else {
                            bootbox.alert(msg["error"]);
                          }
                        }
                      }
                    }
                    if (jsep !== undefined && jsep !== null) {
                      Janus.debug("Handling SDP as well...");
                      Janus.debug(jsep);
                      sfutest.handleRemoteJsep({jsep: jsep});
                      // Check if any of the media we wanted to publish has
                      // been rejected (e.g., wrong or unsupported codec)
                      var audio = msg["audio_codec"];
                      if (mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
                        // Audio has been rejected
                        toastr.warning("Our audio stream has been rejected, viewers won't hear us");
                      }
                      var video = msg["video_codec"];
                      if (mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
                        // Video has been rejected
                        toastr.warning("Our video stream has been rejected, viewers won't see us");
                        // Hide the webcam video
                        $('#myvideo').hide();
                        $('#videolocal').append(
                          '<div class="no-video-container">' +
                          '<i class="fa fa-video-camera fa-5 no-video-icon" style="height: 100%;"></i>' +
                          '<span class="no-video-text" style="font-size: 16px;">Video rejected, no webcam</span>' +
                          '</div>');
                      }
                    }
                  },
                  onlocalstream: function (stream) {
                    Janus.debug(" ::: Got a local stream :::");
                    mystream = stream;
                    Janus.debug(stream);
                    Janus.debug(stream.getTracks());
                    $('#videojoin').hide();
                    $('#videos').removeClass('hide').show();
                    if ($('#myvideo').length === 0) {
                      $('#videolocal').append('<video class="rounded centered" id="myvideo" width="100%" height="100%" autoplay playsinline muted="muted"/>');
                      // Add a 'mute' button
                      $('#videolocal').append('<button class="btn btn-warning btn-xs" id="mute" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;">Mute</button>');
                      $('#mute').click(toggleMute);
                      // Add an 'unpublish' button
                      $('#videolocal').append('<button class="btn btn-warning btn-xs" id="unpublish" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;">Unpublish</button>');
                      $('#unpublish').click(unpublishOwnFeed);
                    }
                    $('#publisher').removeClass('hide').html(myusername).show();
                    Janus.attachMediaStream($('#myvideo').get(0), stream);
                    $("#myvideo").get(0).muted = "muted";
                    if (sfutest.webrtcStuff.pc.iceConnectionState !== "completed" &&
                      sfutest.webrtcStuff.pc.iceConnectionState !== "connected") {
                      $("#videolocal").parent().parent().block({
                        message: '<b>Publishing...</b>',
                        css: {
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: 'white'
                        }
                      });
                    }
                    var videoTracks = stream.getVideoTracks();
                    if (videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                      // No webcam
                      $('#myvideo').hide();
                      if ($('#videolocal .no-video-container').length === 0) {
                        $('#videolocal').append(
                          '<div class="no-video-container">' +
                          '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                          '<span class="no-video-text">No webcam available</span>' +
                          '</div>');
                      }
                    } else {
                      $('#videolocal .no-video-container').remove();
                      $('#myvideo').removeClass('hide').show();
                    }
                  },
                  onremotestream: function (stream) {
                    // The publisher stream is sendonly, we don't expect anything here
                  },
                  oncleanup: function () {
                    Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
                    mystream = null;
                    $('#videolocal').html('<button id="publish" class="btn btn-primary">Publish</button>');
                    $('#publish').click(function () {
                      publishOwnFeed(true);
                    });
                    $("#videolocal").parent().parent().unblock();
                    $('#bitrate').parent().parent().addClass('hide');
                    $('#bitrate a').unbind('click');
                  }
                });
            },
            error: function (error) {
              Janus.error(error);
              bootbox.alert(error, function () {
                window.location.reload();
              });
            },
            destroyed: function () {
              window.location.reload();
            }
          });

    }
  });
}


function mockMaker() {
  if (janus == null) initJanus();
  $.get(isMockRunningAPI, function (data) {
    if (data.isRunning === true && janus == null) {
      initJanus();
    } else if (data.isRunning === false && janus != null) {
      window.location.reload();
    }
  });
}

var forceReloadIntervalInMs = 15 * 60 * 1000;
$(document).ready(function() {
  // Initialize the library (all console debuggers enabled)
  $('#testmock').one('click', function () {
    mockMedia();
  });
  mockMaker();
  // for reload every X mins
  setInterval(() => window.location.reload(), forceReloadIntervalInMs);
  setInterval(() => mockMaker(), 30 * 1000);
});

function checkEnter(field, event) {
  var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
  if(theCode == 13) {
    registerUsername();
    return false;
  } else {
    return true;
  }
}

function randomString(len) {
  charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var randomString = '';
  for (var i = 0; i < len; i++) {
    var randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz,randomPoz+1);
  }
  return randomString;
}

function registerUsername() {
  if($('#username').length === 0) {
    // Create fields to register
    $('#register').click(registerUsername);
    $('#username').focus();
  } else {
    // Try a registration
    $('#username').attr('disabled', true);
    $('#register').attr('disabled', true).unbind('click');
    var username = $('#username').val();
    if(username === "") {
      $('#you')
        .removeClass().addClass('label label-warning')
        .html("Insert your display name (e.g., pippo)");
      $('#username').removeAttr('disabled');
      $('#register').removeAttr('disabled').click(registerUsername);
      return;
    }
    if(/[^a-zA-Z0-9]/.test(username)) {
      $('#you')
        .removeClass().addClass('label label-warning')
        .html('Input is not alphanumeric');
      $('#username').removeAttr('disabled').val("");
      $('#register').removeAttr('disabled').click(registerUsername);
      return;
    }
    var register = { "request": "join", "room": myroom, "ptype": "publisher", "display": username };
    myusername = username;
    sfutest.send({"message": register});
    // document.getElementById("mock-audio").srcObject = silenceStream();
    // document.getElementById("mock-audio").play();
  }
  // myusername = prompt("Your name");
  // var register = { "request": "join", "room": myroom, "ptype": "publisher", "display": myusername };
  // sfutest.send({"message": register});
}

function publishOwnFeed(useAudio) {
  // Publish our stream
  $('#publish').attr('disabled', true).unbind('click');
  sfutest.createOffer(
    {
      // Add data:true here if you want to publish datachannels as well
      media: { audioRecv: false, videoRecv: false, audioSend: true, videoSend: true },	// Publishers are sendonly
      simulcast: false,
      simulcast2: false,
      success: function(jsep) {
        Janus.debug("Got publisher SDP!");
        Janus.debug(jsep);
        var publish = { "request": "configure", "audio": useAudio, "video": true };
        // You can force a specific codec to use when publishing by using the
        // audiocodec and videocodec properties, for instance:
        // 		publish["audiocodec"] = "opus"
        // to force Opus as the audio codec to use, or:
        // 		publish["videocodec"] = "vp9"
        // to force VP9 as the videocodec to use. In both case, though, forcing
        // a codec will only work if: (1) the codec is actually in the SDP (and
        // so the browser supports it), and (2) the codec is in the list of
        // allowed codecs in a room. With respect to the point (2) above,
        // refer to the text in janus.plugin.videoroom.jcfg for more details
        sfutest.send({"message": publish, "jsep": jsep});
      },
      error: function(error) {
        Janus.error("WebRTC error:", error);
        if (useAudio) {
          publishOwnFeed(false);
        } else {
          bootbox.alert("WebRTC error... " + JSON.stringify(error));
          $('#publish').removeAttr('disabled').click(function() { publishOwnFeed(true); });
        }
      }
    });
}

function toggleMute() {
  var muted = sfutest.isAudioMuted();
  Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
  if(muted)
    sfutest.unmuteAudio();
  else
    sfutest.muteAudio();
  muted = sfutest.isAudioMuted();
  $('#mute').html(muted ? "Unmute" : "Mute");
}

function unpublishOwnFeed() {
  // Unpublish our stream
  $('#unpublish').attr('disabled', true).unbind('click');
  var unpublish = { "request": "unpublish" };
  sfutest.send({"message": unpublish});
}

function newRemoteFeed(id, display, audio, video) {
  // A new feed has been published, create a new plugin handle and attach to it as a subscriber
  var remoteFeed = null;
  janus.attach(
    {
      plugin: "janus.plugin.videoroom",
      opaqueId: opaqueId,
      success: function(pluginHandle) {
        remoteFeed = pluginHandle;
        remoteFeed.simulcastStarted = false;
        Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
        Janus.log("  -- This is a subscriber");
        // We wait for the plugin to send us an offer
        var subscribe = { "request": "join", "room": myroom, "ptype": "subscriber", "feed": id, "private_id": mypvtid };
        // In case you don't want to receive audio, video or data, even if the
        // publisher is sending them, set the 'offer_audio', 'offer_video' or
        // 'offer_data' properties to false (they're true by default), e.g.:
        // 		subscribe["offer_video"] = false;
        // For example, if the publisher is VP8 and this is Safari, let's avoid video
        if(Janus.webRTCAdapter.browserDetails.browser === "safari" &&
          (video === "vp9" || (video === "vp8" && !Janus.safariVp8))) {
          if(video)
            video = video.toUpperCase()
          toastr.warning("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
          subscribe["offer_video"] = false;
        }
        remoteFeed.videoCodec = video;
        remoteFeed.send({"message": subscribe});
      },
      error: function(error) {
        Janus.error("  -- Error attaching plugin...", error);
        bootbox.alert("Error attaching plugin... " + error);
      },
      onmessage: function(msg, jsep) {
        Janus.debug(" ::: Got a message (subscriber) :::");
        Janus.debug(msg);
        var event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if(msg["error"] !== undefined && msg["error"] !== null) {
          bootbox.alert(msg["error"]);
        } else if(event != undefined && event != null) {
          if(event === "attached") {
            // Subscriber created and attached
            for(var i=1;i<participants;i++) {
              if(feeds[i] === undefined || feeds[i] === null) {
                feeds[i] = remoteFeed;
                remoteFeed.rfindex = i;
                break;
              }
            }
            remoteFeed.rfid = msg["id"];
            remoteFeed.rfdisplay = msg["display"];
            if(remoteFeed.spinner === undefined || remoteFeed.spinner === null) {
              var target = document.getElementById('videoremote'+remoteFeed.rfindex);
              remoteFeed.spinner = new Spinner({top:100}).spin(target);
            } else {
              remoteFeed.spinner.spin();
            }
            Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
            $('#remote'+remoteFeed.rfindex).removeClass('hide').html(remoteFeed.rfdisplay).show();
          } else if(event === "event") {
            // Check if we got an event on a simulcast-related event from this publisher
            console.log("received event: \t actual-msg: {}", event, msg);
          } else {
            // What has just happened?
          }
        }
        if(jsep !== undefined && jsep !== null) {
          Janus.debug("Handling SDP as well...");
          Janus.debug(jsep);
          // Answer and attach
          remoteFeed.createAnswer(
            {
              jsep: jsep,
              // Add data:true here if you want to subscribe to datachannels as well
              // (obviously only works if the publisher offered them in the first place)
              media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
              success: function(jsep) {
                Janus.debug("Got SDP!");
                Janus.debug(jsep);
                var body = { "request": "start", "room": myroom };
                remoteFeed.send({"message": body, "jsep": jsep});
              },
              error: function(error) {
                Janus.error("WebRTC error:", error);
                bootbox.alert("WebRTC error... " + JSON.stringify(error));
              }
            });
        }
      },
      webrtcState: function(on) {
        Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
      },
      onlocalstream: function(stream) {
        // The subscriber stream is recvonly, we don't expect anything here
      },
      onremotestream: function(stream) {
        Janus.debug("Remote feed #" + remoteFeed.rfindex);
        var addButtons = false;
        if($('#remotevideo'+remoteFeed.rfindex).length === 0) {
          addButtons = true;
          // No remote video yet
          $('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered" id="waitingvideo' + remoteFeed.rfindex + '" width=320 height=240 />');
          $('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered relative hide" id="remotevideo' + remoteFeed.rfindex + '" width="100%" height="100%" autoplay playsinline/>');
          $('#videoremote'+remoteFeed.rfindex).append(
            '<span class="label label-primary hide" id="curres'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;"></span>' +
            '<span class="label label-info hide" id="curbitrate'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;"></span>');
          // Show the video, hide the spinner and show the resolution when we get a playing event
          $("#remotevideo"+remoteFeed.rfindex).bind("playing", function () {
            if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
              remoteFeed.spinner.stop();
            remoteFeed.spinner = null;
            $('#waitingvideo'+remoteFeed.rfindex).remove();
            if(this.videoWidth)
              $('#remotevideo'+remoteFeed.rfindex).removeClass('hide').show();
            var width = this.videoWidth;
            var height = this.videoHeight;
            $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
            if(Janus.webRTCAdapter.browserDetails.browser === "firefox") {
              // Firefox Stable has a bug: width and height are not immediately available after a playing
              setTimeout(function() {
                var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
                var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
                $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
              }, 2000);
            }
          });
        }
        Janus.attachMediaStream($('#remotevideo'+remoteFeed.rfindex).get(0), stream);
        setInterval(function () {

          if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null) {
            console.log("video still not playing for feed ", remoteFeed, ", attempting reattach stream to video");
            Janus.attachMediaStream($('#remotevideo'+remoteFeed.rfindex).get(0), stream);
          }
          // retry attach if spinner not unset every 5 secs
        }, 5000);
        var videoTracks = stream.getVideoTracks();
        if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
          // No remote video
          $('#remotevideo'+remoteFeed.rfindex).hide();
          if($('#videoremote'+remoteFeed.rfindex + ' .no-video-container').length === 0) {
            $('#videoremote'+remoteFeed.rfindex).append(
              '<div class="no-video-container">' +
              '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
              '<span class="no-video-text">No remote video available</span>' +
              '</div>');
          }
        } else {
          console.log("no of tracks rcvd: {}", stream.getVideoTracks())
          $('#videoremote'+remoteFeed.rfindex+ ' .no-video-container').remove();
          $('#remotevideo'+remoteFeed.rfindex).removeClass('hide').show();
        }
        if(!addButtons)
          return;
        if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
          Janus.webRTCAdapter.browserDetails.browser === "safari") {
          $('#curbitrate'+remoteFeed.rfindex).removeClass('hide').show();
          bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
            // Display updated bitrate, if supported
            var bitrate = remoteFeed.getBitrate();
            $('#curbitrate'+remoteFeed.rfindex).text(bitrate);
            // Check if the resolution changed too
            var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
            var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
            if(width > 0 && height > 0)
              $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
          }, 1000);
        }
      },
      oncleanup: function() {
        Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
        if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
          remoteFeed.spinner.stop();
        remoteFeed.spinner = null;
        $('#remotevideo'+remoteFeed.rfindex).remove();
        $('#waitingvideo'+remoteFeed.rfindex).remove();
        $('#novideo'+remoteFeed.rfindex).remove();
        $('#curbitrate'+remoteFeed.rfindex).remove();
        $('#curres'+remoteFeed.rfindex).remove();
        if(bitrateTimer[remoteFeed.rfindex] !== null && bitrateTimer[remoteFeed.rfindex] !== null)
          clearInterval(bitrateTimer[remoteFeed.rfindex]);
        bitrateTimer[remoteFeed.rfindex] = null;
        remoteFeed.simulcastStarted = false;
        $('#simulcast'+remoteFeed.rfindex).remove();
      }
    });
}