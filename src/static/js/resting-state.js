const remote = require('electron').remote
const app = remote.app

const nodejs_path = require('path');
const fs = require('fs')

const task_name = 'resting-state';
const path_to_alldata = nodejs_path.join(app.getPath('desktop'), 'OCD-Project-Data');

// How long to gather resting-state data for:
const task_minutes = 3;
// Values to send to the 'USB event marker' arduino when an event happens.
// Make sure the 'open_resting_task' value doesn't conflict with any value sent
// by any other task, since we use it to uniquely identify this task. It's ok
// for other values to be re-used in other tasks.
const event_codes = {
  'open_resting_task': 12,
  'start_rest': 10,
  'end_rest': 11,
  'left': 1,
  'right': 2,
  'up': 3,
  'down': 4,
  'center': 5,
  'blink_start': 6,
  'blink_stop': 7,
  'close_eyes': 8,
  'open_eyes': 9
}

// Use the current time and date for naming the log file
const time_opened = new Date();

// Should be overwritten by user input
let patient_ID = 'TEST_ID'


const fullscreen_shortcut = (process.platform === 'darwin') ? 'Command Control F' : 'Fn F11' //else, linux
const zoomin_shortcut = (process.platform === 'darwin') ? 'Command =' : 'Control Shift =' //else, linux
const zoomout_shortcut = (process.platform === 'darwin') ? 'Command -' : 'Control -' //else, linux

/********** Timeline Components **********/

var new_experiment_screen = {
  type: 'html-button-response',
  stimulus: '<span id="task-name"><h1>Resting State Task</h1></span>' + photodiode_box(false),
  choices: ['Continue'],
  on_load: () => (document.getElementsByClassName('jspsych-content-wrapper')[0].style.cursor = 'default')
}

const adjust_zoom = {
  'type': 'html-keyboard-response',
  'choices': [' '],
  'stimulus': [
    '<div id="stimulus-container">',
    '<div id="empty-container">',
    '<div>',
      "<h3 id='usb-alert'></h3>",
      '<h3>Press the Space key to continue.</h3>',
    '</div>',
    '</div>',
    '</div>',
    '</div>',
    photodiode_box(false)
  ].join(''),
  on_load: () => (eventMarkerMessage().then(s => document.getElementById('usb-alert').innerHTML = s ))
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
        sendToPort(port, code);
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
    arr.push(makeTaskStartLog())
    console.log(arr)
  }
}

const instructions = {
  'type': 'instructions',
  'pages': [
    '<h3 class="instructions-text">' +
      'Please sit quietly for the next ' + minutes_to_string(task_minutes) + '.' +
      '</h3>' +
      '<h3 class="instructions-text">Try to fixate on and follow the dot on the screen as it moves.</h3>' +
      '<h3 class="instructions-text">Try to relax.</h3>' +
      '<h3 class="instructions-text">Press the Space key to begin.</h3>'
  ],
  'key_forward': ' ',
  'on_load': () => (document.getElementsByClassName('jspsych-content-wrapper')[0].style.cursor = 'none')
}


const start_rest  = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': '<div id="dot-container"><div id="fixation-dot"> </div></div>' + photodiode_box(true),
  'response-ends-trial': false,
  'trial_duration': 86000,
  'on_load': function() {
    const code = event_codes.start_rest;
    sendToPort(port, code);
    PD_spot_encode(code);
  }
}

const look_left  = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': '<div id="dot-container"><div id="fixation-dot"> </div></div>' + photodiode_box(true),
  'trial_duration': 15000,
  'on_load': () => {
      const code = event_codes.left;
      moveThree('left', code);
    }
}

const look_right  = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': '<div id="dot-container"><div id="fixation-dot"> </div></div>' + photodiode_box(false),
  'trial_duration': 15000,
  'on_load': () => {
    const code = event_codes.right;
    const center = event_codes.center;
    sendToPort(port, center);
    PD_spot_encode(center);
    moveThree('right', code);
    }
}

const look_up  = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': '<div id="dot-container"><div id="fixation-dot"> </div></div>' + photodiode_box(true),
  'trial_duration': 15000,
  'on_load': () => {
    const code = event_codes.up;
    moveThree('top', code);
    }
}

const look_down  = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': '<div id="dot-container"><div id="fixation-dot"> </div></div>' + photodiode_box(true),
  'trial_duration': 15000,
  'on_load': () => {
    const code = event_codes.down;
    moveThree('bottom', code);
    }
}

const blink_instructions = {
  'type': 'instructions',
  'pages': [
    '<h3 class="instructions-text">For this next section, start blinking when you hear a "beep", and stop when you hear another "beep".</h3>' +
    '<h3 class="instructions-text">Press the Space key when you are ready.</h3>'
  ],
  'key_forward': ' ',
  'on_load': () => (document.getElementsByClassName('jspsych-content-wrapper')[0].style.cursor = 'none')
}

const blink_task = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': '<div id="dot-container"><h3>Blink.</h3></div>' + photodiode_box(false),
  'trial_duration': 13000,
  'on_load': () =>  (blinkTask())
}

const close_instructions = {
  'type': 'instructions',
  'pages': [
    '<h3 class="instructions-text">For this next section, close your eyes when you hear a "beep", and open when you hear a "beep" again.</h3>' +
    '<h3 class="instructions-text">Press the Space key when you are ready.</h3>'
  ],
  'key_forward': ' ',
  'on_load': () => (document.getElementsByClassName('jspsych-content-wrapper')[0].style.cursor = 'none')
} 

const close_task = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': '<div id="dot-container"><h3>Close your eyes.</h3></div>' + photodiode_box(false),
  'trial_duration': 13000,
  'on_load': () => (closeEyesTask())
}

const instructions_final = {
  'type': 'instructions',
  'pages': [
    '<h3 class="instructions-text">' +
      'Please sit quietly for the next 1.5 minute.' +
      '</h3>' +
      '<h3 class="instructions-text">For the remaining minute and a half, fixate on the dot in the middle of the screen and relax.</h3>' +
      '<h3 class="instructions-text">Try to relax.</h3>' +
      '<h3 class="instructions-text">Press the Space key to begin.</h3>'
  ],
  'key_forward': ' ',
  'on_load': () => (document.getElementsByClassName('jspsych-content-wrapper')[0].style.cursor = 'none')
}

const resting_task = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': '<div id="dot-container"><div id="fixation-dot"> </div></div>' + photodiode_box(true),
  'response-ends-trial': false,
  'trial_duration': minutes_to_millis(task_minutes),
  'on_load': function() {
    sendToPort(port, event_codes.start_rest);
    appendToListInFile(makeTaskStartLog(), getLogPath(time_opened));
  },

  'on_finish': function(data) {
    sendToPort(port, event_codes.end_rest);
    PD_spot_encode(event_codes.end_rest);
    appendToListInFile(makeTaskEndLog(), getLogPath(time_opened));
  }
}

const finish_up = {
  'type': 'html-keyboard-response',
  'choices': jsPsych.NO_KEYS,
  'stimulus': 'The resting state task is complete.' + photodiode_box(true), 
  'on_load': () => {
    sendToPort(port, event_codes.end_rest);
    PD_spot_encode(event_codes.end_rest);
    appendToListInFile(arr, getLogPath(time_opened));

  }
}


/************ Task-specific Utilites *************/


var arr = [];

function makeTaskStartLog() {
  return {
    'task': task_name,
    'start_end': 'start',
    'timestamp': Date.now(),
    'patient_ID': patient_ID,
    'usb_event_marker_codes': event_codes,
    'planned_duration_milliseconds': minutes_to_millis(task_minutes),
  };
}

function makeTaskEndLog() {
  return {
    'task': task_name,
    'start_end': 'end',
    'timestamp': Date.now(),
    'patient_ID': patient_ID,
  };
}

function minutes_to_millis(num_minutes) {
  return num_minutes * 60 * 1000;
}

function minutes_to_string(num_minutes) {
  let string = num_minutes + ' minute';
  if (num_minutes != 1) {
    string = string + 's'
  }
  return string;
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
  // Convert the 1 or 2-digit number to a string. If it has only 1 digit, pad with a zero on the left.
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
  var currObj = {
    'event_code': num_code,
    'timestamp': Date.now(),    
  };
  arr.push(currObj);
  console.log(arr)

  const spot = document.getElementById('photodiode-spot')
	if (num_code < 12) {
		num_code = 1
		}
  repeat_pulse_for(spot, 40, num_code)

}

function photodiode_box(is_lit) {
  const style = is_lit ? 'lit' : 'unlit';
  return "<div class='photodiode-box' id='photodiode-box'>" +
    `<span class='photodiode-spot ${style}' id='photodiode-spot'></span>` +
    "</div>";
}


function begin() {
  jsPsych.init({
    timeline: [
      new_experiment_screen,
      adjust_zoom,
      resting_pulse_encode,
      enter_patient_info,
      instructions,
      look_right,
      look_left,
      look_up,
      look_down,
      blink_instructions,
      blink_task,
      close_instructions,
      close_task,
      instructions_final,
      start_rest,
      finish_up
    ]
  })
}

window.onload = function() {
  // TODO inline begin?
  begin()
}
