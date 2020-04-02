const couchdbUrl = 'http://localhost:5984'

const getChanges = async (username, onchange, since) => {
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

const NewRepoForm = username => {
  const form = document.createElement('form')
  
  const p = document.createElement('p')
  form.appendChild(p)
  
  const reponameLabel = document.createElement('label')
  reponameLabel.innerText = 'New Reposiotory'
  reponameLabel.setAttribute('for', 'reponame')
  p.appendChild(reponameLabel)
  const reponameInput = document.createElement('input')
  reponameInput.type = 'text'
  reponameInput.id = 'reponame'
  reponameInput.placeholder = 'my-shiny-repo'
  p.appendChild(reponameInput)

  const submitButton = document.createElement('button')
  submitButton.innerText = 'Create'
  submitButton.type = 'submit'
  p.appendChild(submitButton)

  form.onsubmit = async e => {
    e.preventDefault()

    const name = reponameInput.value

    const response = await fetch(`${couchdbUrl}/${username}/repo:${name}`, {
      method: 'PUT',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ requested: new Date })
    })

    const json = await response.json()

    if (json.ok) {
      reponameInput.value = ''
    }
  }

  return form
}

const ActivityStream = (username) => {
  const div = document.createElement('div')

  const h2 = document.createElement('h2')
  h2.innerText = 'Activity'
  div.appendChild(h2)

  const p = document.createElement('p')
  p.innerText = `Your stream is available at http://localhost:5984/${username}/_changes`
  div.appendChild(p)

  const ul = document.createElement('ul')
  div.appendChild(ul)

  return {
    div,
    prepend: text => {
      const li = document.createElement('li')
      li.innerText = text
      ul.prepend(li)
    }
  }
}

const RepoList = username => {
  const div = document.createElement('div')
  
  const h2 = document.createElement('h2')
  h2.innerText = 'Your Repositories'
  div.appendChild(h2)
  
  const form = NewRepoForm(username)
  div.appendChild(form)
  
  const ul = document.createElement('ul')
  div.appendChild(ul)

  const lis = {}

  return {
    div,
    prepend: (id, text, created) => {
      const className = created ? 'created' : 'requested'
      if (id in lis) {
        lis[id].innerText = text
        lis[id].className = className
        return
      }
      lis[id] = document.createElement('li')
      lis[id].innerText = text
      lis[id].className = className
      ul.prepend(lis[id])
    }
  }
}

const Dashboard = async (username, properties) => {
  const repoList = RepoList(username)
  const activityStream = ActivityStream(username)

  properties.elements.article.innerHTML = ''
  properties.elements.article.appendChild(repoList.div)
  properties.elements.article.appendChild(activityStream.div)

  const h1 = document.createElement('h1')
  h1.innerText = `Hi ${username}`
  properties.elements.header.innerHTML = ''
  properties.elements.header.appendChild(h1)

  getChanges(username, change => {
    const parts = change.id.split(':')
    const [type, name, subtype, subname, subsubtype, subsubname] = parts

    if (type === 'repo' && parts.length === 2) {
      repoList.prepend(change.id, `http://localhost:8080/${username}/${name}.git`, change.doc && change.doc.provisionedAt)
    }
    if (type === 'repo' && subtype === 'branch' && subsubtype === 'ref' && parts.length === 6) {
      activityStream.prepend(`pushed to repo ${name} on branch ${subname} ref ${subsubname.slice(0, 7)}`)
    }
  })
}

const LoginForm = properties => {
  const form = document.createElement('form')
  
  const usernameLabel = document.createElement('label')
  usernameLabel.innerText = 'Username'
  usernameLabel.setAttribute('for', 'username')
  form.appendChild(usernameLabel)
  const usernameInput = document.createElement('input')
  usernameInput.type = 'text'
  usernameInput.id = 'username'
  usernameInput.placeholder = 'eva'
  form.appendChild(usernameInput)

  const passwordLabel = document.createElement('label')
  passwordLabel.innerText = 'Password'
  passwordLabel.setAttribute('for', 'password')
  form.appendChild(passwordLabel)
  const passwordInput = document.createElement('input')
  passwordInput.type = 'password'
  passwordInput.id = 'password'
  passwordInput.placeholder = 'my secrest secret'
  form.appendChild(passwordInput)

  const submitButton = document.createElement('button')
  submitButton.innerText = 'Login'
  submitButton.type = 'submit'
  form.appendChild(submitButton)

  form.onsubmit = async e => {
    e.preventDefault()

    const name = usernameInput.value
    const password = passwordInput.value

    const response = await fetch(`${couchdbUrl}/_session`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, password })
    })

    const json = await response.json()

    if (json.ok) {
      await Dashboard(name, properties)
    }
  }

  properties.elements.article.innerHTML = ''
  properties.elements.article.appendChild(form)

  const h1 = document.createElement('h1')
  h1.innerText = 'Please Login'
  properties.elements.header.innerHTML = ''
  properties.elements.header.appendChild(h1)
}

export const App = properties => {
  LoginForm(properties)
}
