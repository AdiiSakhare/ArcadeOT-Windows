# Modbus RTU / serial

Planned driver; not equivalent to raw TCP. Register/function semantics come from Modbus application specification, while serial framing/timing comes from Serial Line V1.02. Configuration requires serial port identity, baud, parity, data/stop bits, station ID, response/interframe deadlines and the actual adapter wiring. RS-485 electrical capability alone does not prove Modbus support.

One scheduler owns a shared serial bus; do not open one competing master per slave. Check CRC, slave ID, function, frame length, exception and silence timing. RTU CRC polynomial/timing must be implemented from the full V1.02 guide, whose body was not retrieved in this research. Do not promote generated CRC vectors to normative evidence. Read-only collector must reject broadcast addressing and all write functions. Confirm local adapter direction control and station uniqueness with hardware.

Unknowns before implementation: approved serial library/adapter, exact DVP/M221 slave map and valid station range, electrical reference ground, termination and protocol-specific timing at chosen baud. The official serial-guide catalogue is linked; acquire the guide before coding the framer.

Sources: [MOD-INDEX](https://www.modbus.org/modbus-specifications), [MOD-APP](https://www.modbus.org/file/secure/modbusprotocolspecification.pdf). See source register for edition/access depth.
