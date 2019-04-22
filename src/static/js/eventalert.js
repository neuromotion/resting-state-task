const SerialPort = require('serialport');

const vendorId = '16c0';
const productId = '0483';

const isPort = async () => {
  const portList = await SerialPort.list()
  const device = portList.filter((device) => {
    return ((device.vendorId === vendorId.toUpperCase() ||
            device.vendorId === vendorId)  && device.productId === productId);
  })
  if (device.length === 1) {
    return true
  }
  else {
    return false
  }
}

const getPort = async () => {
  const portList = await SerialPort.list()
  const device = portList.filter((device) => {
    return ((device.vendorId === vendorId.toUpperCase() ||
            device.vendorId === vendorId)  && device.productId === productId);
  })
  const path = device[0].comName;
  const port = new SerialPort(path)
  return port
}

const sendToPort = async (port, event_code) => {
  port.then(p => p.write(Buffer.from([event_code])))
}

const eventMarkerMessage = async () => {
	const is_port = await isPort();
	if (is_port === true) {
		return '<span style="color: green;">' +
		'Hold the USB event marker in front of the camera.</span>';
	}
	else {
		return '<span style="color: red;">' +
		'Note: no USB event marker found.</span>';
	}
}

const port = getPort();
