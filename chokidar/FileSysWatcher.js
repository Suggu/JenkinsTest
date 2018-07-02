/*To access the configuraion*/
require('dotenv').config();

/* HTTP Request*/
var request = require('request');

/*Logging*/
var winston = require('winston');
require('winston-daily-rotate-file');

/* File system watcher main library */
var chokidar = require('chokidar');

/* For console logging */
var log = console.log.bind(console);

/* For fault handling */
var polly=require ('./polly');

const {  createLogger, format, transports } = require('winston');
const {  combine,timestamp,label,printf } = format;

const myFormat = printf(info => {
    return `${info.timestamp} | ${info.level} | ${info.message}`;
});

var transport = new (winston.transports.DailyRotateFile)({
    filename: process.env.LOG_FILE_NAME+'-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '100m',
    maxFiles: '10d'
  });

const logger = winston.createLogger({
   // level: 'info',
    // format: winston.format.json(),
    format: combine(
        timestamp(),
        myFormat
    ),
    transports: [
        /*- Write to all logs with level `info` and below to `combined.log` 
          - Write all logs error (and below) to `error.log`. */
        new winston.transports.File({
            filename: process.env.ERROR_FILE_NAME,
            level: 'error'
        }),
        transport
        // new winston.transports.File({
        //     filename: process.env.LOG_FILE_NAME,
        //     level: 'info',
        //     maxsize: process.env.MAX_LOG_SIZE_IN_BYTES
        // })       
    ],
    exceptionHandlers: [
        new transports.File({ filename: process.env.EXCEPTION_FILE_NAME })
      ]
});

var path = process.env.FILE_PATH;
var watcher = chokidar.watch(path + '/**/*.[pP][Dd][Ff]', {
    persistent: true,
    awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 2000
    },
    ignoreInitial: true
});
// Event listeners.
watcher
    .on('add', path => {
        try {
            MakeApiRequest(path);
        } catch (ex) {
            logger.error(`Exception occured for the file : ${path}
             && Exception: ${ex}. Retrying the file`);            
        }
    });
    // Extra event listeners which will not make api call
watcher.on('change', path => logger.info(`File ${path} has been changed`));
watcher.on('unlink', path => logger.info(`File ${path} has been removed`));
watcher.on('addDir', path => logger.info(`Directory ${path} has been added`));
watcher.on('unlinkDir', path => logger.info(`Directory ${path} has been removed`));
watcher.on('error', error => logger.info(`Watcher error: ${error}`));
watcher.on('ready', () => logger.info('Initial scan complete. Ready for changes'),
log('Ready for watching the files.'));


/* API method call */
function MakeApiRequest(path) {
    polly() .handle(function(err) {
        return err.code === '200';
    })
    .waitAndRetry([1000, 20000])
    .executeForPromise(function () {
      return  request.get(process.env.API_URL + path, function(error, response, body) {
            if (error) {
                logger.error(`Error occured for the File : ${path} && ${error}`);
            } else {
                logger.info(`Response for the file : ${path} && Response: ${ response.statusCode}`);
            }
        });
    })
    .then(function(result) {
        logger.info(result)
    }, function(err) {
        logger.error('Failed trying two times', err)
    });





    logger.info(`File is added ${path}`);
    request.get(process.env.API_URL + path, function(error, response, body) {
        if (error) {
            logger.error(`Error occured for the File : ${path} && ${error}`);
        } else {
            logger.info(`Responde for the file : ${path} && Response: ${ response.statusCode}`);
        }
    });
}
