import * as couch from '/couch.js'

const RepositoriesListEntry = (properties, doc) => {
  const template = properties.templates.repositoriesListEntry
  const clone = document.importNode(template.content, true)
  const li = clone.querySelector('li')
  li.innerText = doc.text
  li.setAttribute('data-id', doc.id)
  li.className = doc.provisionedAt ? 'provisioned' : 'requested'
  return clone
}

const ActivitiesListEntry = (properties, doc) => {
  const template = properties.templates.activitiesListEntry
  const clone = document.importNode(template.content, true)
  const li = clone.querySelector('li')
  li.innerText = doc.text
  return clone
}

const Dashboard = async (properties, username) => {
  const template = properties.templates.dashboard
  const clone = document.importNode(template.content, true)

  clone.querySelector('h2').innerText = `Hi ${username},`

  const form = clone.querySelector('form')
  const reponameInput = clone.querySelector('input[name=reponame]')

  form.onsubmit = async e => {
    e.preventDefault()
    const name = reponameInput.value
    const response = await couch.createRepoRequest(username, name)
    if (response.ok) {
      reponameInput.value = ''
    }
  }

  const repositoriesList = clone.querySelector('#repositories-list')
  const activitiesList = clone.querySelector('#activities-list')
  const repositoriesListElements = {}

  couch.getChanges(username, change => {
    const parts = change.id.split(':')
    const [type, name, subtype, subname, subsubtype, subsubname] = parts

    if (type === 'repo' && parts.length === 2) {
      const entry = RepositoriesListEntry(properties, {
        id: change.id,
        text: `http://localhost:8080/${username}/${name}.git`,
        provisionedAt: change.doc.provisionedAt
      })
      const existing = repositoriesList.querySelector(`[data-id="${change.id}"]`)
      if (existing) {
        repositoriesList.replaceChild(entry, existing)
      } else {
        repositoriesList.prepend(entry)
      }
    }
    if (type === 'repo' && subtype === 'branch' && subsubtype === 'ref' && parts.length === 6) {
      const entry = ActivitiesListEntry(properties, {
        text: `pushed to repo ${name} on branch ${subname} ref ${subsubname.slice(0, 7)}`
      })
      activitiesList.prepend(entry)
    }
  })
  
  const logoutLink = clone.querySelector('a')
  logoutLink.onclick = async e => {
    e.preventDefault()
    const response = await couch.deleteSession()
    if (response.ok) {
      LoginForm(properties)
    }
  }
  
  properties.elements.article.innerHTML = ''
  properties.elements.article.appendChild(clone)
}

const SignupForm = properties => {
  const template = properties.templates.signupForm
  const clone = document.importNode(template.content, true)

  const form = clone.querySelector('form')
  const usernameInput = clone.querySelector('input[name=username]')
  const passwordInput = clone.querySelector('input[name=password]')

  form.onsubmit = async e => {
    e.preventDefault()
    const name = usernameInput.value
    const password = passwordInput.value
    const response = await couch.createUser(name, password)
    if (response.ok) {
      await LoginForm(properties)
    }
  }

  properties.elements.article.innerHTML = ''
  properties.elements.article.appendChild(clone)
}

const LoginForm = properties => {
  const template = properties.templates.loginForm
  const clone = document.importNode(template.content, true)

  const form = clone.querySelector('form')
  const usernameInput = clone.querySelector('input[name=username]')
  const passwordInput = clone.querySelector('input[name=password]')

  form.onsubmit = async e => {
    e.preventDefault()
    const name = usernameInput.value
    const password = passwordInput.value
    const response = await couch.createSession(name, password)
    if (response.ok) {
      await Dashboard(properties, name)
    }
  }
  
  const signupLink = clone.querySelector('a')
  signupLink.onclick = e => {
    e.preventDefault()
    SignupForm(properties)
  }

  properties.elements.article.innerHTML = ''
  properties.elements.article.appendChild(clone)
}

export const App = async properties => {
  const response = await couch.getSession()
  if (response.ok && response.userCtx.name) {
    Dashboard(properties, response.userCtx.name)
  } else {
    LoginForm(properties)
  }
}
