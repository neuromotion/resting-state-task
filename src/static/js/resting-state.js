const remote = require('electron').remote
const app = remote.app

const nodejs_path = require('path');
const fs = require('fs')

const task_name = 'resting-state';
const path_to_alldata = nodejs_path.join(app.getPath('desktop'), 'OCD-Project-Data');

// Values to send to the 'USB event marker' arduino when an event happens.
// Make sure the 'open_resting_task' value doesn't conflict with any value sent
// by any other task, since we use it to uniquely identify this task. It's ok
// for other values to be re-used in other tasks.
const event_codes = {
  'open_resting_task': 12,
  'start_rest': 1,
  'end_rest': 2,
}

// Use the current time and date for naming the log file
const time_opened = new Date();

// Should be overwritten by user input
let patient_ID = 'TEST_ID'

// Attempt to open the USB Event Marker serial port now.
const event_marker_port = openEventMarkerPort();


/********** Timeline Components **********/

var new_experiment_screen = {
  type: 'html-button-response',
  stimulus: '<span id="task-name"><h1>Resting State Task</h1></span>' + photodiode_box(false),
  choices: ['Continue'],
  on_load: () => (document.getElementsByClassName('jspsych-content-wrapper')[0].style.cursor = 'default')
}

const resting_pulse_encode = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'trial_duration': 2000,
  'stimulus': '<h1>Setting up task, please wait...</h1>' + photodiode_box(false),
  'on_load': function() {
    setTimeout(
      function() {
        // Mark the start of the task by flashing the photodiode spot and sending an event code.
        const code = event_codes.open_resting_task;
        PD_spot_encode(code);
        sendUsbEvent(code);
      },
      400)
  }
}

let enter_patient_info = {
  type: 'survey-text',
  questions: [{ prompt: '<span id="patient-id-please">Please enter patient ID.</span>'}],
  on_load: () => (document.getElementsByClassName('jspsych-content-wrapper')[0].style.cursor = 'default'),
  on_finish: function(data) {
    const answer = JSON.parse(data.responses)['Q0']
    patient_ID = (answer === '') ? patient_ID : answer
  }
}

const instructions = {
  'type': 'instructions',
  'pages': [
    '<h3 class="instructions-text">Please sit quietly for the next three minutes.</h3><h3 class="instructions-text">Try to fixate on the dot on the screen</h3><h3 class="instructions-text">Keep your eyes open and try not to move around too much</h3><h3 class="instructions-text">Press the Space key to begin</h3>'
  ],
  'key_forward': ' ',
  'on_load': () => (document.getElementsByClassName('jspsych-content-wrapper')[0].style.cursor = 'none')
}

const resting_task = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': '<div id="fixation-dot">hi</div>' + photodiode_box(true),
  'response-ends-trial': false,
  'trial_duration': minutes_to_millis(3),
  'on_load': function() {
    sendUsbEvent(event_codes.start_rest);
    appendToListInFile(newMetadata('start'), getLogPath(time_opened));
  },

  'on_finish': function(data) {
    sendUsbEvent(event_codes.end_rest);
    appendToListInFile(newMetadata('end'), getLogPath(time_opened));
  }
}

const finish_up = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': 'The resting state task is complete.'
}


/************ Task-specific Utilites *************/

function newMetadata(start_or_end) {
  // start_or_end should be either the string 'start' or 'end'.
  return {
    'task': task_name,
    'start_end': start_or_end,
    'timestamp': Date.now(),
    'patient_ID': patient_ID,
    'metadata': []
  };
}

function minutes_to_millis(num_minutes) {
  return num_minutes * 60 * 1000;
}

/************ Logging Utilities **************/

function getLogPath(date_obj) {
  // Pick the path to the log file (including directories and file that might not exist yet).
  const date = dateString(date_obj);
  const date_time = dateTimeString(date_obj);
  const filename = [patient_ID, task_name, date_time].join('_') + '.JSON';
  const folder = nodejs_path.join(path_to_alldata, patient_ID, date, task_name);
  return nodejs_path.join(folder, filename);
}


function dateTimeString(date_obj) {
  return [dateString(date_obj), timeString(date_obj)].join('_');
}

function dateString(date_obj) {
  return [
    date_obj.getFullYear(),
    zeroPadTwoDigits(date_obj.getMonth()+1),
    zeroPadTwoDigits(date_obj.getDate())
  ].join('-');
}

function timeString(date_obj) {
  return [
    date_obj.getHours(), date_obj.getMinutes(), date_obj.getSeconds()
  ].map(zeroPadTwoDigits).join('-');
}

function zeroPadTwoDigits(number) {
  // Convert the 1 or 2-digit number to a string. If it has only 1 digit, pad
  // with a zero on the left.
  return ('0' + number).slice(-2);
}


/************ File-Saving Utilities *********************/

function overwriteFile(data, path_to_file) {
  fs.writeFile(path_to_file, data, (err) => {
    if (err) throw err;
    console.log('Data saved to ' + path_to_file)
  })
}

function mkdirRecursive(new_path) {
  // Make any directories on the given path that don't exist yet.
  nodejs_path.dirname(new_path)
    .split(nodejs_path.sep)
    .reduce((currentPath, folder) => {
      currentPath += folder + nodejs_path.sep;
      if (!fs.existsSync(currentPath)){
        fs.mkdirSync(currentPath);
      }
      return currentPath;
    }, '');
}

function appendToListInFile(object, path) {
  const object_json = JSON.stringify(object);
  if (fs.existsSync(path)) {
    // Modify the existing file.
    fs.readFile(path, 'utf-8', function(err, fs_data) {
      if (err) throw err;
      // Trim whitespace (like a trailing newline), then remove the last
      // character of the file, which we assume was a `]`.
      let newStream = fs_data.trim().slice(0, -1);
      // Append the new object and close the array again with a `]`.
      newStream += ',';
      newStream += object_json + ']';
      overwriteFile(newStream, path);
    })
  }
  else {
    // Create the new file and any directories along the path that don't exist yet.
    // Put the object as the sole element of a list.
    mkdirRecursive(path);
    const newStream = '[' + object_json + ']';
    overwriteFile(newStream, path);
  }
}



/************ Photodiode Spot *********************/

function PD_spot_encode(num_code) {
  function pulse_for(elem, ms, callback) {
    elem.style.backgroundColor = 'white'
    setTimeout(() => {
      elem.style.backgroundColor = 'black'
      callback()
    }, ms)
  }

  function repeat_pulse_for(elem, ms, i) {
    if (i > 0) {
      pulse_for(elem, ms, () => {
        setTimeout(() => {
          repeat_pulse_for(elem, ms, i-1)
        }, ms)
      })
    }
  }

  const spot = document.getElementById('photodiode-spot')
  repeat_pulse_for(spot, 40, num_code)
}

function photodiode_box(is_lit) {
  const style = is_lit ? 'lit' : 'unlit';
  return "<div class='photodiode-box' id='photodiode-box'>" +
    `<span class='photodiode-spot ${style}' id='photodiode-spot'></span>` +
    "</div>";
}


/************ USB Event Marker support ************/

// Open a serial port to the "USB event marker".
// Return a fs.WriteStream to the port, or null if something failed.
function openEventMarkerPort() {
  try {
    // Use a python script to find which serial port the USB event marker is
    // attached to, if any.
    const execFileSync = require('child_process').execFileSync;
    const out = execFileSync(
      "/home/evan/USB-event-marker/find_event_marker_port.py",
      [],
      {encoding: 'utf-8'}
    )
    const port_path = out.trim();
    // Open the port and return a WriteStream to it.
    return fs.createWriteStream(port_path);
  }
  catch (e) {
    // Failed - maybe the script isn't installed, or the event marker isn't plugged in.
    console.log("Failed to open event marker port")
    console.log(e)
    return null
  }
}

function sendUsbEvent(event_code) {
  // Send the event code to the "USB event marker" arduino, over a serial port.
  // Event code should be a number in range [1,31].
  if (event_marker_port === null) {
    console.log("Tried to send event, but event marker port wasn't opened")
  }
  else {
    event_marker_port.write(Buffer.from([event_code]));
  }
}


function begin() {
  jsPsych.init({
    timeline: [
      new_experiment_screen,
      resting_pulse_encode,
      enter_patient_info,
      instructions,
      resting_task,
      finish_up
    ]
  })
}

window.onload = function() {
  // TODO inline begin?
  begin()
}
