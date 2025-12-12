/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
  // if deployed to a site supporting SSL, use wss://
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  // A class for holding the last N points of telemetry for a device
  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 50;
	  // Stores data from sound, door state, and light
      this.timeData = new Array(this.maxLen);
      this.soundData = new Array(this.maxLen);
      this.doorStateData = new Array(this.maxLen);
	  this.lightData = new Array(this.maxLen);
    }

    addData(time, sound, doorState, light) {
      this.timeData.push(time);
      this.soundData.push(sound);
      this.doorStateData.push(doorState);
	  this.lightData.push(light);

      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.soundData.shift();
        this.doorStateData.shift();
		this.lightData.shift();
      }
    }
  }

  // All the devices in the list (those that have been sending telemetry)
  class TrackedDevices {
    constructor() {
      this.devices = [];
    }

    // Find a device based on its Id
    findDevice(deviceId) {
      for (let i = 0; i < this.devices.length; ++i) {
        if (this.devices[i].deviceId === deviceId) {
          return this.devices[i];
        }
      }

      return undefined;
    }

    getDevicesCount() {
      return this.devices.length;
    }
  }

  const trackedDevices = new TrackedDevices();

  // Create a canvas for the graph
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "30px";
  container.style.width = "100%";

  // Sound graph
  const soundCanvas = document.createElement("canvas");
  soundCanvas.id = "soundChart";
  container.appendChild(soundCanvas);

  // Door State graph
  const doorCanvas = document.createElement("canvas");
  doorCanvas.id = "doorChart";
  container.appendChild(doorCanvas);

  // Light graph
  const lightCanvas = document.createElement("canvas");
  lightCanvas.id = "lightChart";
  container.appendChild(lightCanvas);

  // Attach to body (or some other container)
  document.body.appendChild(container);


// Three separate charts
  const baseOptions = {
	scales: {
	  yAxes: [{
		ticks: { beginAtZero: true }
	  }]
	},
	spanGaps: true
  };
  
  // Sound chart
  const soundChart = new Chart(document.getElementById('soundChart').getContext('2d'), {
	type: 'line',
	data: {
	  labels: [],
	  datasets: [{
		label: 'Sound',
		borderColor: 'rgba(255, 99, 132, 1)',
		fill: false
	  }]
	},
	options: baseOptions
  });
  
  // Door State chart
  const doorChart = new Chart(document.getElementById('doorChart').getContext('2d'), {
	type: 'line',
	data: {
	  labels: [],
	  datasets: [{
		label: 'Door State',
		borderColor: 'rgba(0, 200, 0, 1)',
		fill: false
	  }]
	},
	options: baseOptions
  });
  
  // Light chart
  const lightChart = new Chart(document.getElementById('lightChart').getContext('2d'), {
	type: 'line',
	data: {
	  labels: [],
	  datasets: [{
		label: 'Light',
		borderColor: 'rgba(255, 204, 0, 1)',
		fill: false
	  }]
	},
	options: baseOptions
  });
  

  // Manage a list of devices in the UI, and update which device data the chart is showing
  // based on selection
  let needsAutoSelect = true;
  const deviceCount = document.getElementById('deviceCount');
  const listOfDevices = document.getElementById('listOfDevices');
  function OnSelectionChange() {
	const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
  
	// Send corresponding data to each chart and update
	soundChart.data.labels = device.timeData;
	soundChart.data.datasets[0].data = device.soundData;
	soundChart.update();
  
	doorChart.data.labels = device.timeData;
	doorChart.data.datasets[0].data = device.doorStateData;
	doorChart.update();
  
	lightChart.data.labels = device.timeData;
	lightChart.data.datasets[0].data = device.lightData;
	lightChart.update();
  }
  listOfDevices.addEventListener('change', OnSelectionChange, false);

  // When a web socket message arrives:
  // 1. Unpack it
  // 2. Validate it has date/time and temperature
  // 3. Find or create a cached device to hold the telemetry data
  // 4. Append the telemetry data
  // 5. Update the chart UI
  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      console.log(messageData);

      // time and one of the Iot data fields are required
      // Ensure message has your required fields
	  if (
  		messageData.MessageDate == null ||
  		messageData.IotData.sound == null ||
  		messageData.IotData.doorState == null ||
  		messageData.IotData.light == null
	) {
  		console.warn("Rejected message due to missing fields:", messageData);
  		return;
	}

	  const existingDeviceData = trackedDevices.findDevice(messageData.DeviceId);

	  if (existingDeviceData) {
	    existingDeviceData.addData(
		  messageData.MessageDate,
		  messageData.IotData.sound,
		  messageData.IotData.doorState,
		  messageData.IotData.light
	  );
	  } else {
	    const newDeviceData = new DeviceData(messageData.DeviceId);
	    trackedDevices.devices.push(newDeviceData);

	    newDeviceData.addData(
		  messageData.MessageDate,
		  messageData.IotData.sound,
		  messageData.IotData.doorState,
		  messageData.IotData.light
	    );

        // add device to the UI list
        const node = document.createElement('option');
        const nodeText = document.createTextNode(messageData.DeviceId);
        node.appendChild(nodeText);
        listOfDevices.appendChild(node);

        // if this is the first device being discovered, auto-select it
        if (needsAutoSelect) {
          needsAutoSelect = false;
          listOfDevices.selectedIndex = 0;
          OnSelectionChange();
        }
      }
	  
	  // update charts
      soundChart.update();
      doorChart.update();
      lightChart.update();
    } catch (err) {
      console.error(err);
    }
  };
});
