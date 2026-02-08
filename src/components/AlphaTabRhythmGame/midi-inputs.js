var midiAccess = null;
var midiInputs = null;
var midiOutputs = null;

function printString(str) {
  var messagelog = document.getElementById("messagelog");
  messagelog.innerHTML += str + "\n";
  messagelog.scrollTop = messagelog.scrollHeight;
}

function printReceivedMessage(portName, data) {
  var str = "port:" + portName + " ";
  for (var i = 0; i < data.length; i++) {
    str += data[i] + " ";
  }

  printString(str);
}

function clearLog() {
  document.getElementById("messagelog").innerHTML = "";
}

function setup() {
  var messagelog = document.getElementById("messagelog");
  if (window.navigator.requestMIDIAccess) {
    window.navigator
      .requestMIDIAccess({ sysex: false })
      .then(success, function () {
        messagelog.innerHTML += "requestMIDIAccess() failed.";
      });
  } else {
    messagelog.innerHTML += "Web MIDI API is not available on your browser.\n";
  }

  function setupEventHandler() {
    var inputs = [];
    var iter = midiAccess.inputs.values();
    for (var o = iter.next(); !o.done; o = iter.next()) {
      inputs.push(o.value);
    }

    for (var port = 0; port < inputs.length; port++) {
      inputs[port].onmidimessage = function (event) {
        printReceivedMessage(event.port, event.data);
      };

      inputs[port].onstatechange = function (event) {
        var port = event.port;
        printString(
          "MIDIInputPort onstatechange name:" +
            port.name +
            " connection:" +
            port.connection +
            " state:" +
            port.state,
        );
      };
    }

    var outputs = [];
    var iter = midiAccess.outputs.values();
    for (var o = iter.next(); !o.done; o = iter.next()) {
      outputs.push(o.value);
    }

    for (var port = 0; port < outputs.length; port++) {
      outputs[port].onstatechange = function (event) {
        var port = event.port;
        printString(
          "MIDIOutputPort onstatechange name:" +
            port.name +
            " connection:" +
            port.connection +
            " state:" +
            port.state,
        );
      };
    }

    midiInputs = inputs;
    midiOutputs = outputs;
  }

  function success(access) {
    midiAccess = access;
    midiAccess.onstatechange = function (event) {
      var port = event.port;
      printString(
        "MIDIAccess onstatechange name:" +
          port.name +
          " connection:" +
          port.connection +
          " state:" +
          port.state,
      );

      if (port.type == "input") {
        port.onmidimessage = function (event) {
          printReceivedMessage(port.name, event.data);
        };
      }
    };

    setupEventHandler();
  }
}
