// In order for the workers runtime to find the class that implements
// our Durable Object namespace, we must export it from the root module.
export { PokerSession } from './PokerSession.mjs'

async function fetchSlackApi(path, env, method='GET') {
  console.log(env.SLACK_TOKEN)
  return await fetch(`https://slack.com/api${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.SLACK_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env)
    } catch (e) {
      return new Response(e.message)
    }
  }
}

const rockMoji = ':rock:'
const paperMoji = ':page_facing_up:'
const scissMoji = ':scissors:'

async function handleRequest(request, env) {
  // get the pathname
  const url = new URL(request.url)
  const { pathname } = url
  if (pathname === '/vote') {
    const inputData = await request.formData()
    const rawPayload = inputData.get('payload')
    const payload = JSON.parse(rawPayload)
    // console.log('!!', payload)
    const {
      actions,
      user: {
        id: userId
      },
      response_url: responseUrl,
    } = payload
    const { value: played, block_id: blockId } = actions[0]
    const responsePayload = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    }
    const [source, rowNo, channelId] = blockId.split('-')
    console.log(channelId)
    const id = env.POKER_SESSION.idFromName(channelId)
    const stub = env.POKER_SESSION.get(id)
    if (played === 'cancel') {
      const url = new URL('../cancel', request.url)
      console.log('cancel url', url.toString())
      const resp = await stub.fetch(url.toString(), new Request(request, { body: JSON.stringify({}) }))
      const doResp = await resp.json()
      console.log('DO says', doResp)
      responsePayload.body = JSON.stringify({ text: 'Vote cancelled'})
      const respond = await fetch(responseUrl, responsePayload)
      return new Response('cancelled')
    } else {
      console.log('here', request.url)
      const resp = await stub.fetch(request.url, new Request(request, { body: JSON.stringify({ vote: played, userId }) }))
      console.log('but not here', resp)
      const talliedVotes = await resp.json()
      const {
        task,
        allVoted,
        votes
      } = talliedVotes
      console.log('!?!?', talliedVotes, allVoted, votes)
      responsePayload.body = JSON.stringify(
        source === 'rps'
          ? { text: `You played ${played}` }
          : { text: `Your estimate is ${played}` }
      )
      console.log('!!!!', responseUrl, responsePayload)
      const respond = await fetch(responseUrl, responsePayload)
      console.log(respond)
      if (allVoted) {
        console.log('all votes are in', source)
        const responseBody = { channel: channelId }
        if (source === 'rps') {
          const results = Object.entries(votes).reduce((acc, [key, value], idx) => {
            console.log(acc, key, value)
            if (idx === 0) return { player1: [key, value]}
            const { player1 } = acc
            const [player1userId, player1played] = player1
            acc.player2 = [key, value]
            console.log(player1userId, player1played, key, value)
            if (player1played === value) return { ...acc, result: 'draw' }
            if (player1played === rockMoji && value === paperMoji) return { ...acc, result: key }
            if (player1played === rockMoji && value === scissMoji) return { ...acc, result: player1userId }
            if (player1played === scissMoji && value === paperMoji) return { ...acc, result: player1userId }
            if (player1played === scissMoji && value === rockMoji) return { ...acc, result: key }
            if (player1played === paperMoji && value === rockMoji) return { ...acc, result: player1userId }
            if (player1played === paperMoji && value === scissMoji) return { ...acc, result: key }
          }, {})
          const { result, player1, player2 } = results
          const [player1userId, player1played] = player1
          const [player2userId, player2played] = player2
          const resultStr = result === 'draw' ? 'a tie!' : `<@${result}> wins!`
          responseBody.text = `<@${player1userId}> ${player1played} v ${player2played} <@${player2userId}> - ${resultStr}`
        } else {
          const voteStr = Object.entries(votes).reduce((acc, [key, value]) => {
            acc.push(`<@${key}>: ${value}`)
            return acc
          }, []).join(', ')
          responseBody.text = `all estimates are in for '${task}'! ${voteStr}`
        }
        console.log('!!', responseBody)
        const messageResponse = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.SLACK_TOKEN}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify(responseBody)
        })
        // console.log('!', messageResponse)
        const messageSuccess = await messageResponse.json()
        return new Response('finished')
      }
      return new Response('voted')
    }
  }
  if (pathname === '/slash') {
    const formData = await request.formData()
    const formDataObj = Object.fromEntries(formData.entries())
    console.log('kicking off vote', formDataObj)
    const {
      command,
      channel_id: channelId,
      user_id: commandUserId,
      text: commandText,
      response_url: responseUrl
    } = formDataObj

    const thisBotResponse = await fetchSlackApi(`/auth.test`, env)
    const thisBot = await thisBotResponse.json()
    const { user_id: botId } = thisBot
    console.log('our bot', botId)

    const participants = []
    const messageContent = {}
    const channelResponse = {
      response_type: 'ephemeral',
    }
    if (command.startsWith('/pokerface')) {
      console.log('planning poker')
      const membersResponse = await fetchSlackApi(`/conversations.members?channel=${channelId}`, env)
      const membersJson = await membersResponse.json()
      console.log('members', membersJson)
      const { ok } = membersJson
      if (!ok) {
        return new Response(`There was a problem getting the list of participants! Did you invite me to the channel or multi-person DM?`)
      }
      const { members } = membersJson
      participants.push(...members.filter(userId => userId !== botId))
      messageContent.text = commandText
      messageContent.blocks = [
        {
          "block_id": "poker",
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `Please give your estimate for the task '${commandText}'`
          }
        },
        {
          "block_id": `poker-1-${channelId}`,
          "type": "actions",
          "elements": [
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "0",
                "emoji": true
              },
              "value": "0"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "1",
                "emoji": true
              },
              "value": "1"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "2",
                "emoji": true
              },
              "value": "2"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "3",
                "emoji": true
              },
              "value": "3"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "5",
                "emoji": true
              },
              "value": "5"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "8",
                "emoji": true
              },
              "value": "8"
            }
          ]
        },
        {
          "block_id": `poker-2-${channelId}`,
          "type": "actions",
          "elements": [
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "13",
                "emoji": true
              },
              "value": "13"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "20",
                "emoji": true
              },
              "value": "20"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "40",
                "emoji": true
              },
              "value": "40"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "100",
                "emoji": true
              },
              "value": "100"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "?",
                "emoji": true
              },
              "value": "?"
            }
          ]
        }
      ]
      channelResponse.text = `Voting started on '${commandText}'`
    }
    if (command.startsWith('/rps')) {
      const challengedUserMatches = Array.from(commandText.matchAll(/^<@(.*)\|.*>$/gm))
      if (challengedUserMatches.length === 0) {
        return new Response(`Please provide a username!`)
      } else {
        const challengedUserId = challengedUserMatches[0][1]
        participants.push(commandUserId, challengedUserId)
        messageContent.text = 'rps challenge!'
        messageContent.blocks = [
          {
            "block_id": "rps",
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": `play now!`
            }
          },
          {
            "block_id": `rps-1-${channelId}`,
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": rockMoji,
                  "emoji": true
                },
                "value": rockMoji,
                "action_id": "rock"
              },
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": paperMoji,
                  "emoji": true
                },
                "value": paperMoji,
                "action_id": "paper"
              },
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": scissMoji,
                  "emoji": true
                },
                "value": scissMoji,
                "action_id": "scissors"
              }
            ]
          }
        ]
        channelResponse.text = `<@${commandUserId}> has challenged <@${challengedUserId}> to ${rockMoji}, ${paperMoji}, ${scissMoji}`
      }
    }
    console.log('getting DO')
    const id = env.POKER_SESSION.idFromName(channelId)
    const stub = env.POKER_SESSION.get(id)
    console.log('got DO')
    const resp = await stub.fetch(request.url, new Request(request, { body: JSON.stringify({ participants, botId, commandText }) }))
    console.log('stub fetched')
    const { voteInProgress } = await resp.json()
    console.log('voteInProgress', voteInProgress)
    if (!voteInProgress) {
      channelResponse.text = `I've started a vote on '${commandText}'`
      const inChannelResponse = await fetch(responseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SLACK_TOKEN}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          response_type: 'in_channel',
          channel: channelId,
          text: `Voting started on '${commandText}'`
        })
      })
      console.log('participants', participants)
      participants.forEach(async function(userId) {
        console.log('in loop', userId)
        // const participantProfileResponse = await fetchSlackApi(`/users.profile.get?user=${userId}`, env)
        // const participantProfile = await participantProfileResponse.json()
        // console.log('participantProfile', participantProfile)
        // const {
        //   profile: {
        //     real_name: realName,
        //     display_name: displayName,
        //     image_24: participantImgUrl
        //   }
        // } = participantProfile
        // // deliberately truthy
        // const participantName = displayName ? displayName : realName
        const messageResponse = await fetch('https://slack.com/api/chat.postEphemeral', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.SLACK_TOKEN}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify({
            channel: channelId,
            user: userId,
            ...messageContent
          })
        })
        const messageSuccess = await messageResponse.json()
        console.log('in channel response', messageSuccess)
      })
    } else {
      const responseText = `There's already a vote in progress!`
      channelResponse.text = responseText
      channelResponse.blocks = [
        {
          "block_id": "in-progress",
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": responseText
          }
        },
        {
          "block_id": `cancel-1-${channelId}`,
          "type": "actions",
          "elements": [
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": 'Cancel Vote',
                "emoji": true
              },
              "value": 'cancel',
              "action_id": "cancel-vote"
            }
          ]
        }
      ]
    }
    return new Response(JSON.stringify(channelResponse),
    {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  return new Response(`Not found`, { status: 404 })
}
