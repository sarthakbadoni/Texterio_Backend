const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const app = express();
const cors = require('cors');
app.use(cors());
process.on('uncaughtException', err => console.error("Uncaught Exception:", err));
process.on('unhandledRejection', err => console.error("Unhandled Rejection:", err));

app.use(bodyParser.json());

app.post('/run', (req, res) => {
  const { code, stdin, language } = req.body;

  let filename, compileCmd, dockerCmd;

  if(language === 'python') {
    filename = 'main.py';
    fs.writeFileSync(filename, code);
    fs.writeFileSync('input.txt', stdin);
    dockerCmd = `cat input.txt | docker run --rm -i -v "$PWD":/app -w /app python:3.9 python main.py`;
    exec(dockerCmd, { shell: '/bin/bash', timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) { res.json({ error: error.message, stderr }); }
      else { res.json({ output: stdout, stderr }); }
    });

  } else if(language === 'c') {
    filename = 'main.c';
    fs.writeFileSync(filename, code);
    fs.writeFileSync('input.txt', stdin);
    compileCmd = `docker run --rm -v "$PWD":/app -w /app gcc:latest gcc ${filename} -o main.out`;
    exec(compileCmd, (err, stdout, stderr) => {
      if(err) return res.json({ error: err.message, stderr });

      dockerCmd = `docker run --rm -v "$PWD":/app -w /app gcc:latest /bin/bash -c './main.out < input.txt'`;
      exec(dockerCmd, { shell: '/bin/bash', timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { res.json({ error: error.message, stderr }); }
        else { res.json({ output: stdout, stderr }); }
      });
    });

  } else if(language === 'cpp') {
    filename = 'main.cpp';
    fs.writeFileSync(filename, code);
    fs.writeFileSync('input.txt', stdin);
    compileCmd = `docker run --rm -v "$PWD":/app -w /app gcc:latest g++ ${filename} -o main.out`;
    exec(compileCmd, (err, stdout, stderr) => {
      if(err) return res.json({ error: err.message, stderr });
      dockerCmd = `cat input.txt | docker run --rm -i -v "$PWD":/app -w /app gcc:latest ./main.out`;
      exec(dockerCmd, { shell: '/bin/bash', timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { res.json({ error: error.message, stderr }); }
        else { res.json({ output: stdout, stderr }); }
      });
    });

  } else if(language === 'java') {
    // Extract class name
    const classMatch = code.match(/public\s+class\s+(\w+)/);
    let className = "Main";
    if (classMatch) className = classMatch[1];

    const filename = `${className}.java`;
    fs.writeFileSync(filename, code);
    fs.writeFileSync('input.txt', stdin);

    // Compile right file
    compileCmd = `docker run --rm -v "$PWD":/app -w /app openjdk:latest javac ${filename}`;
    exec(compileCmd, (err, stdout, stderr) => {
      if(err) return res.json({ error: err.message, stderr });

      dockerCmd = `cat input.txt | docker run --rm -i -v "$PWD":/app -w /app openjdk:latest java ${className}`;
      exec(dockerCmd, { shell: '/bin/bash', timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { res.json({ error: error.message, stderr }); }
        else { res.json({ output: stdout, stderr }); }
      });
    });

  } else if(language === 'nodejs' || language === 'javascript') {
    filename = 'main.js';
    fs.writeFileSync(filename, code);
    fs.writeFileSync('input.txt', stdin);
    dockerCmd = `cat input.txt | docker run --rm -i -v "$PWD":/app -w /app node:current node ${filename}`;
    exec(dockerCmd, { shell: '/bin/bash', timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) { res.json({ error: error.message, stderr }); }
      else { res.json({ output: stdout, stderr }); }
    });

  } else {
    res.json({ error: "Language not supported." });
  }

});

app.listen(3000, () => console.log('API listening on port 3000'));

