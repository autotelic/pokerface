export class PokerSession {
  constructor(state, env) {
    this.state = state
  }

  async startVoting(request) {

  }

  async fetch(request) {
    const url = new URL(request.url)
    const { pathname } = url
    const body = await request.json()
    console.log(pathname, body)
    if (pathname === '/slash') {
      const { commandText: task, participants } = body
      console.log(participants)
      const storedVoteInProgress = await this.state.storage.get('voteInProgress')
      let voteInProgress = storedVoteInProgress === undefined ? false : storedVoteInProgress
      if (!voteInProgress) {
        const votes = {}
        await this.state.storage.put({
          participants,
          votes,
          voteInProgress: true,
          task
        })
      }
      return new Response(JSON.stringify({ voteInProgress }))
    } else if (pathname === '/cancel') {
      await this.state.storage.put({
        votes: {},
        participants: [],
        voteInProgress: false,
        task: null
      })
      return new Response(JSON.stringify({ cancelled: true }))
    } else if (pathname === '/vote') {
      const { vote, userId } = body
      console.log(vote, userId)
      const storedVotes = await this.state.storage.get('votes')
      const task = await this.state.storage.get('task')
      console.log('storedVotes', storedVotes)
      console.log('task', task)
      const voted = Object.keys(storedVotes)
      console.log(voted, userId)
      if (voted.includes(userId)) {
        console.log('already voted')
        return new Response(`user ${userId} has already voted`)
      } else {
        const updatedVotes = {
          [userId]: vote,
          ...storedVotes
        }
        console.log(updatedVotes)
        const participants = await this.state.storage.get('participants')
        console.log(participants.length, Object.keys(updatedVotes).length)
        await this.state.storage.put('votes', updatedVotes)
        const allVoted = participants.length === Object.keys(updatedVotes).length
        if (allVoted) {
          await this.state.storage.put('votes', {})
          await this.state.storage.put('voteInProgress', false)
        }
        return new Response(JSON.stringify({
          allVoted,
          task,
          votes: updatedVotes
        }))
      }
    } else {
      return new Response(JSON.stringify({ foo: 'bar' }))
    }
  }
}
