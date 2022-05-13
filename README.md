# githubstats

> a Twitter bot which visualizes the commit activity of a GitHub user over the past 30 days

This bot will listen to any mentions on Twitter every 10 minutes and then reply with a bar graph containing the number of commits over the past 30 days of the GitHub user that was mentioned in the Tweet.

Note that this is merely <b>proof-of-concept</b>. It does not handle errors or log outputs in any meaningful way, it only displays a single statistic (which is commit activity over 30 days). It was however an interesting way to explore interactivity between APIs and data visualization.

## Install

With [npm](https://npmjs.org/) installed, navigate to the project's root directory and run

```
$ npm install
```

## Usage

1. First of all, you need to register a Twitter API application (for API version 1.1) as well as retrieve a GitHub API key (not necessarily OAuth, a regular key will do)
2. Then, register all your API keys in the "config.env.template" file and rename it to "config.env"
3. Lastly, navigate to the project's root directory and run the bot via

```
$ node bot.js
```
