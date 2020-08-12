
// Add this to the VERY top of the first file loaded in your app
var apm = require('elastic-apm-node').start({
    // Override service name from package.json
    // Allowed characters: a-z, A-Z, 0-9, -, _, and space
    serviceName: 'fileupload1',
  
    // Use if APM Server requires a token
    secretToken: '',
  
    // Set custom APM Server URL (default: http://localhost:8200)
    serverUrl: ''
  })

const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');

const app = express();

// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

//add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(morgan('dev'));

//start app 
const port = process.env.PORT || 3000;

app.get('/', function (req, res) {
    res.send('This is so cool!')
})

function runSubTask (name, type, cb) {
    console.log("Staring span: " + name);
    var span = apm.startSpan(name)
    setTimeout(function () {
        if (span) {
            console.log("ending span");
            span.end()
        }
        cb()
    }, Math.random() * 1000).unref()
}

app.post('/upload-avatar', async (req, res) => {
    var name = 'upload-avatar';
    var type = 'avatar';
    console.log("Starting transaction");
    var transaction = apm.startTransaction(name, type);

    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            console.log("Running fake span");
            // Simulate a task doing something
            runSubTask("fake span", type, function() {
                //Use the name of the input field (i.e. "avatar") to retrieve the uploaded file
                let avatar = req.files.avatar;
                
                console.log("Staring span: Saving pictures");
                var span = apm.startSpan('Saving pictures')
                //Use the mv() method to place the file in upload directory (i.e. "uploads")
                avatar.mv('./uploads/' + avatar.name);
                if (span) {
                    console.log("ending span");
                    span.end()
                }

                //send response
                res.send({
                    status: true,
                    message: 'File is uploaded',
                    data: {
                        name: avatar.name,
                        mimetype: avatar.mimetype,
                        size: avatar.size
                    }
                }); 

                if (transaction) {
                    console.log("end transaction");
                    transaction.end();
                }  
            })
        }
    } catch (err) {
        res.status(500).send(err);
        console.log("Capturing error");
        apm.captureError(err);
    }
});

app.post('/upload-photos', async (req, res) => {
    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            let data = []; 
    
            //loop all files
            _.forEach(_.keysIn(req.files.photos), (key) => {
                let photo = req.files.photos[key];
                
                //move photo to uploads directory
                photo.mv('./uploads/' + photo.name);

                //push file details
                data.push({
                    name: photo.name,
                    mimetype: photo.mimetype,
                    size: photo.size
                });
            });
    
            //return response
            res.send({
                status: true,
                message: 'Files are uploaded',
                data: data
            });
        }
    } catch (err) {
        res.status(500).send(err);
        apm.captureError(err);
    }
});


app.listen(port, () => 
  console.log(`App is listening on port ${port}.`)
);