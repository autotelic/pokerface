const DurableObjectMixin


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
    if (pathname === '/slash') {
      const { commandText: task } = body
      const storedVoteInProgress = await this.state.storage.get('voteInProgress')
      let voteInProgress = storedVoteInProgress === undefined ? false : storedVoteInProgress
      if (!voteInProgress) {
        const votes = {}
        await this.state.storage.put({
          votes,
          voteInProgress: true,
          task
        })
      } 
      return new Response(JSON.stringify({ voteInProgress }))
    } else if (pathname === '/participants') {
      console.log(body)
    } else if (pathname === '/vote') {
      const { vote, userId } = body
      const storedVotes = await this.state.storage.get('votes')
      const task = await this.state.storage.get('task')
      console.log('storedVotes', storedVotes)
      const voted = Object.keys(storedVotes)
      console.log(voted, userId)
      if (voted.includes(userId)) {
        return new Response(`user ${userId} has already voted`)
      } else {
        const updatedVotes = {
          [userId]: vote,
          ...storedVotes
        }
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