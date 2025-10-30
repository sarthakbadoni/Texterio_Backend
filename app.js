const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const gemini = new GoogleGenAI({ apiKey: 'AIzaSyByAGUzVhGNYVdyZZ9UACaB4Fbq9CUkkEU' });

async function explainWithGemini(code, language = "") {
  try {
    const prompt = `
Imagine you are a super concise, beginner-friendly code tutor.
A student ran this code in the language ${language} and got an error at runtime or compile time.

- Find the mistake or point of confusion based on the code.
- Suggest the best 1-2 line fix or correct usage, if possible.
- Prioritize likely typos, built-in function misuse, missing base case, or common errors.
- If the code recursively calls itself without a stop condition, mention stack overflow.
- Your answer should only be:
Correction: <suggested one-line code change, only if relevant>
Reason: <very short, clear beginner explanation>
No Markdown unless it's needed for clarity.

CODE (${language}):
---
${code}
---
`;
    const result = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }]}]
    });

    let gText = "";
    if (result && result.response && typeof result.response.text === "string") {
      gText = result.response.text;
    } else if (result && typeof result.text === "string") {
      gText = result.text;
    } else if (result && Array.isArray(result.candidates) && result.candidates[0]?.content?.parts?.[0]?.text) {
      gText = result.candidates[0].content.parts[0].text;
    } else {
      gText = "No Gemini explanation available.";
    }
    return gText.trim();
  } catch (e) {
    return "Could not contact Gemini: " + e.message;
  }
}

app.post('/run', (req, res) => {
  const { code, stdin, language } = req.body;
  let filename, compileCmd, dockerCmd;

  function handleResult(error, stdout, stderr) {
    if (error || stderr) {
      explainWithGemini(code, language)
        .then(explanation => {
          res.json({
            output: stdout,
            error: error ? error.message : undefined,
            stderr,
            explanation
          });
        });
    } else {
      res.json({ output: stdout, stderr: null });
    }
  }

  if(language === 'python') {
    filename = 'main.py';
    fs.writeFileSync(filename, code);
    fs.writeFileSync('input.txt', stdin);
    dockerCmd = `cat input.txt | docker run --rm -i -v "$PWD":/app -w /app python:3.9 python main.py`;
    exec(dockerCmd, { shell: '/bin/bash', timeout: 5000, maxBuffer: 1024 * 1024 }, handleResult);

  } else if(language === 'c') {
    filename = 'main.c';
    fs.writeFileSync(filename, code);
    fs.writeFileSync('input.txt', stdin);
    compileCmd = `docker run --rm -v "$PWD":/app -w /app gcc:latest gcc ${filename} -o main.out`;
    exec(compileCmd, (err, stdout, stderr) => {
      if(err) return handleResult(err, stdout, stderr);
      dockerCmd = `docker run --rm -v "$PWD":/app -w /app gcc:latest /bin/bash -c './main.out < input.txt'`;
      exec(dockerCmd, { shell: '/bin/bash', timeout: 5000, maxBuffer: 1024 * 1024 }, handleResult);
    });

  } else if(language === 'cpp') {
    filename = 'main.cpp';
    fs.writeFileSync(filename, code);
    fs.writeFileSync('input.txt', stdin);
    compileCmd = `docker run --rm -v "$PWD":/app -w /app gcc:latest g++ ${filename} -o main.out`;
    exec(compileCmd, (err, stdout, stderr) => {
      if(err) return handleResult(err, stdout, stderr);
      dockerCmd = `cat input.txt | docker run --rm -i -v "$PWD":/app -w /app gcc:latest ./main.out`;
      exec(dockerCmd, { shell: '/bin/bash', timeout: 5000, maxBuffer: 1024 * 1024 }, handleResult);
    });

  } else if(language === 'java') {
    const classMatch = code.match(/public\s+class\s+(\w+)/);
    let className = "Main";
    if (classMatch) className = classMatch[1];
    filename = `${className}.java`;
    fs.writeFileSync(filename, code);
    fs.writeFileSync('input.txt', stdin);
    compileCmd = `docker run --rm -v "$PWD":/app -w /app openjdk:latest javac ${filename}`;
    exec(compileCmd, (err, stdout, stderr) => {
      if(err) return handleResult(err, stdout, stderr);
      dockerCmd = `cat input.txt | docker run --rm -i -v "$PWD":/app -w /app openjdk:latest java ${className}`;
      exec(dockerCmd, { shell: '/bin/bash', timeout: 5000, maxBuffer: 1024 * 1024 }, handleResult);
    });

  } else if(language === 'nodejs' || language === 'javascript') {
    filename = 'main.js';
    fs.writeFileSync(filename, code);
    fs.writeFileSync('input.txt', stdin);
    dockerCmd = `cat input.txt | docker run --rm -i -v "$PWD":/app -w /app node:current node ${filename}`;
    exec(dockerCmd, { shell: '/bin/bash', timeout: 5000, maxBuffer: 1024 * 1024 }, handleResult);

  } else {
    res.json({ error: "Language not supported." });
  }
});

app.listen(3000, () => console.log('API listening on port 3000'));
