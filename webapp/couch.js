const couchdbUrl = 'http://localhost:5984'

export const getSession = async () => {
  const response = await fetch(`${couchdbUrl}/_session`, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  })
  return await response.json()
}

export const createSession = async (name, password) => {
  const response = await fetch(`${couchdbUrl}/_session`, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ name, password })
  })
  return await response.json()
}

export const deleteSession = async () => {
  const response = await fetch(`${couchdbUrl}/_session`, {
    method: 'DELETE',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  })
  return await response.json()
}

export const createUser = async (name, password) => {
  const _id = `org.couchdb.user:${name}`
  const response = await fetch(`${couchdbUrl}/_users/${_id}`, {
    method: 'PUT',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      _id,
      name,
      password,
      type: 'user',
      roles: []
    })
  })
  return await response.json()
}

export const getChanges = async (username, onchange, since) => {
  const response = await fetch(`${couchdbUrl}/${username}/_changes?feed=longpoll&include_docs=true${since ? '&since=' + since : ''}`, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  })
  const json = await response.json()
  for (const result of json.results) {
    onchange(result)
  }
  getChanges(username, onchange, json.last_seq)
}

export const createRepoRequest = async (username, name) => {
  const _id = `repo:${name}`
  const requestedAt = new Date()
  const response = await fetch(`${couchdbUrl}/${username}/${_id}`, {
    method: 'PUT',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({
      _id,
      requestedAt
    })
  })
  return await response.json()
}
