export class PokerSession {
  constructor(state, env) {
    this.state = state
  }
  
  async fetch(request) {
    const url = new URL(request.url)
    const { pathname } = url
    const storedVoteInProgress = await this.state.storage.get('voteInProgress')
    let voteInProgress = storedVoteInProgress === undefined ? false : storedVoteInProgress
    if (pathname === '/slash') {
      const body = await request.json()
      const { commandText: task, participants } = body
      if (!voteInProgress) {
        voteInProgress = true
        await this.state.storage.put('votes', {})
        await this.state.storage.put('participants', participants)
        await this.state.storage.put('voteInProgress', voteInProgress)
        await this.state.storage.put('task', task)
        return new Response(`voting started for '${task}'`)
      } else {
        return new Response(`voting already in progress for '${task}'`)
      }
    } else if (pathname === '/vote') {
      const body = await request.json()
      console.log(body)
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