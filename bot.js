const dotenv = require('dotenv')
const Twitter = require('twitter')
const GitHub = require('github-api')
const QuickChart = require('quickchart-js')

dotenv.config({ path: './config.env' })

const twitterClient = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_SECRET
})

const gitHubClient = new GitHub({
  token: process.env.GITHUB_TOKEN
})

// The ID of the most recent tweet that has already been processed
let mostRecentTweetID = ''

// An array to store the fetched tweets each time
let latestMentions = []

async function getNewMentions () {
  // Fetch all the mentions since the latest processed one, if there was one
  twitterClient.get('statuses/mentions_timeline', mostRecentTweetID === '' ? {} : { since_id: mostRecentTweetID }, function (_error, tweets) {
    latestMentions = tweets
    if (latestMentions.length > 0) {
      // Set the latest processed tweet ID
      mostRecentTweetID = tweets[0].id_str
      // process the tweets
      try {
        processTweets()
      } catch (ex) {
        console.log(ex.message)
      }
    }
  })
}

// When first booting the bot up, we want to avoid processing ALL tweets;
// the bot will only start processing new incoming tweets
async function setFirstMentionID () {
  twitterClient.get('statuses/mentions_timeline', { count: 1 }, function (_error, tweets) {
    latestMentions = tweets
    if (latestMentions.length > 0) {
      mostRecentTweetID = tweets[0].id_str
      try {
        // processTweets(); //TODO: REMOVE AFTER DEBUGGING!
      } catch (ex) {
        console.log(ex.message)
      }
    }
  })
}

function processTweets () {
  /* Three major blocks:
    1. Get username mentioned + author of the tweet from each tweet
    2. Gather information for each user from the GitHub API
    3. Reply to the author of the tweet with the visualized information
    */

  // 1st block: Extracting necessary information from the tweets
  const gitHubUsernames = []
  const twitterProfileNames = []
  const tweetIDs = []

  latestMentions.forEach((x) => {
    twitterProfileNames.push(x.user.screen_name)
    tweetIDs.push(x.id_str)
    const content = x.text
    const indexOfMention = content.toLowerCase().indexOf('@githubstats')
    gitHubUsernames.push(content.substr(indexOfMention + 13, content.length))
    // Note: We do not care if the substring is actually a valid GitHub username,
    // we just assume it is - if it isn't, the API will not return a proper value and
    // the bot will simply not tweet
  })

  // 2nd block: Ask GitHub for all the user information needed
  gitHubUsernames.forEach((ghUsrName, i) => {
    const user = gitHubClient.getUser(ghUsrName)

    // Array of all repos of the user
    const repos = []
    // Array of all commits of the user (last 30 days)
    const commits = []

    // Gather all Repos from the user
    user.listRepos(function (error, result) {
      if (error) throw error
      else {
        result.forEach(repo => {
          repos.push(repo.full_name)
        })
      }
    }).then(() => {
      // Now iterate over all of the repos and gather all commits the user made in the last 30 days on any of them
      let processedRepos = 0
      repos.forEach(repoName => {
        const repo = gitHubClient.getRepo(repoName.split('/')[0], repoName.split('/')[1])
        const oneMonthAgo = new Date(new Date().setDate(new Date().getDate() - 30))

        // On each repo of the user, we look at the commits only they themselves made; limit by 30 days
        repo.listCommits({ author: ghUsrName, since: oneMonthAgo }, function (_error, result) {
          result.forEach(commit => {
            commits.push(commit)
          })
          processedRepos++
          if (processedRepos === repos.length) {
            commitsProcessed()
          }
        })
      })
    })

    // Once all commits are gathered, we can continue
    const commitsProcessed = () => {
      // First we make sure the commits are sorted by date
      commits.sort(function (commitA, commitB) { return new Date(commitA.commit.committer.date) - new Date(commitB.commit.committer.date) })

      // Now we process the commit data, meaning: which dates has the user committed on during the past 30 days and how often per day
      const dates = []
      commits.forEach(commit => {
        const newDate = commit.commit.committer.date.substr(0, 10)
        if (!dates.includes(newDate)) {
          dates.push(newDate)
        }
      })

      const counts = []
      commits.forEach(commit => {
        const index = dates.indexOf(commit.commit.committer.date.substr(0, 10))
        while (index >= counts.length) counts.push(0)
        counts[index]++
      })

      // Create a bar chart with the gathered data
      const genChart = new QuickChart()
      genChart.setConfig({
        type: 'bar',
        data: {
          labels: dates,
          datasets: [{
            label: '# of commits from ' + ghUsrName + ' in their own repos over the past 30 days',
            data: counts
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      }).setWidth(800).setHeight(600).setBackgroundColor('white')

      // Convert the chart to Base64-String
      genChart.toDataUrl().then((chartBase64Img) => {
        // The Twitter-API needs us to remove the "data:image/png;base64," for some reason, it does not specify so in their Docs either
        chartBase64Img = chartBase64Img.substr(22, chartBase64Img.length)

        // Now upload the image...
        twitterClient.post('media/upload', { media_data: chartBase64Img }, function (error, data) {
          if (error) throw error
          // ...then reply to the original tweet!
          twitterClient.post('statuses/update', { media_ids: data.media_id_string, status: '@' + twitterProfileNames[i] + ' Total repositories: ' + repos.length, in_reply_to_status_id: tweetIDs[i], auto_populate_reply_metadata: true }, function (error, tweet) {
            if (error) throw error
            console.log(tweet)
          })
        })
      })
    }
  })
}

// set the ID, so the bot only looks at new incoming tweets
setFirstMentionID()

// check for new tweets every 10 minutes
setInterval(getNewMentions, 1000 * 60 * 10)
