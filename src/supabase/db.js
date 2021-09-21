import supabase from './core'
import {omitBy,isNil} from 'lodash-es'

export async function createSite() {
  const { data, error } = await supabase
    .from('sites')
    .insert([
      { name: 'Test Name', repository : 'bb8ac5dd-37dd-4503-8ba0-69c55270e86e' }
    ])
}

export async function createAccount(userUID) {
  const user = await users.get(userUID)
}

export async function acceptInvitation(pass, userID) {
  const {data,error} = await supabase
    .from('sites')
    .select('password, id, collaborators, owner (username, id, websites)')
    .or(`password.eq.CONTENT-${pass},password.eq.DEV-${pass}`)
  const site = data[0]
  if (!site || error) { // password incorrect
    console.error(error)
    return {error}
  }

  const collaborators = site.collaborators || []
  const {websites} = await users.get(userID, `websites`)

  const role = site.password.includes('DEV') ? 'DEV' : 'CONTENT'
  const date = (new Date()).toJSON()

  // link is valid, add collaborator to site (user id, role)
  const [ collaboratorAdded ] = await Promise.all([
    sites.update(site.id, { 
      collaborators: JSON.stringify([ ...collaborators, {
        id: userID,
        role: 'DEV',
        created: date,
        loggedin: date
      }]),
      password: '' 
    }),
    users.update(userID, {
      websites: [ ...websites, site.id ] // concat 
    })
  ])
  
  return collaboratorAdded
}

export async function checkUsernameAvailability(username) {
  const {data,error} = await supabase
    .from('users')
    .select('id')
    .filter('username', 'eq', username)
  return data[0] ? false : true
}

const DEFAULT_SITES_QUERY = `
  id,
  name,
  url,
  data,
  repo (
    owner,
    name,
    url,
    isPublic
  ),
  password,
  owner (
    id,
    username,
    tokens
  ),
  collaborators,
  collaborator_data,
  hosts
`

export const sites = {
  get: async ({id = null, path = null, query = DEFAULT_SITES_QUERY }) => {
    let site
    if (id) {
      const {data,error} = await supabase
        .from('sites')
        .select(query)
        .filter('id', 'eq', id)
      if (error) {
        console.error(error)
        return null
      } else {
        const site = data[0]
        if (site) {
          let { data, collaborators } = site
          if (data && typeof data === 'string') {
            site.data = JSON.parse(data)
          }
        }
        return site
      }
    } else if (path) {
      const [ user, siteUrl ] = path.split('/')
      const {data,error} = await supabase
        .from('sites')
        .select(query)
        .filter('owner.username', 'eq', user)
        .filter('url', 'eq', siteUrl)
      if (error) {
        console.error(error)
        site = null
      } else {
        site = data[0]
      }
    } else {
      const {data,error} = await supabase
        .from('sites')
        .select(query)
      site = data
    }
    if (site && typeof site.data === 'string') {
      site.data = JSON.parse(site.data)
    }
    return site
  },
  create: async ({ id, name, owner }) => {
    const { data, error } = await supabase
      .from('sites')
      .insert([
        { id, name, owner }
      ])
    if (error) {
      console.error(error)
      return null
    }
    return data[0]
  },
  delete: async (id) => {
    const { data, error } = await supabase
      .from('sites')
      .delete()
      .match({ id })
    if (error) {
      console.error(error)
      return null
    }
    return data
  },
  save: async (id, site) => {
    const json = JSON.stringify(site)
    const { data, error } = await supabase
      .from('sites')
      .update({ data:json }, {
        returning: 'minimal'
      })
      .filter('id', 'eq', id)
    if (error) {
      console.error(error)
      return false
    }
    return true
  },
  update: async (id, props) => {
    const { error } = await supabase
      .from('sites')
      .update(props, {
        returning: 'minimal'
      })
      .filter('id', 'eq', id)
    if (error) {
      console.error(error)
      return null
    }
    return true
  },
  subscribe: async (id, fn) => {
    const mySubscription = supabase
      // .from('countries:id=eq.200')
      .from(`websites:id=eq.${id}`)
      .on('UPDATE', fn)
      .subscribe()
  }
}

export const users = {
  get: async (uid, select = '*') => {
    let {data,error} = await supabase
      .from('users')
      .select(select)
      .eq('id', uid)

    if (error) {
      console.error(error)
      return null
    }
    data = data[0]
    // if (data.websites) {
    //   data.websites = data.websites.map(site => ({
    //     ...site,
    //     collaborators: site.collaborators && site.collaborators.length > 0 ? JSON.parse(site.collaborators) : []
    //   }))
    // }
    return data
  },
  create: async ({ email }) => {

    const { data, error } = await supabase
      .from('users')
      .insert([ { email } ], {
        returning: 'minimal'
      })
    if (error) {
      console.error(error)
      return false
    }
    return true
  },
  update: async (id, props) => {
    const { data, error } = await supabase
      .from('users')
      .update(props)
      .eq('id', id)

    if (error) {
      console.error(error)
      return null
    }
    return data[0]
  }
}

export const hosts = {
  get: async (id) => {
    let {data,error} = await supabase
      .from('hosts')
      .select('*')
      // .filter('id', 'eq', id)
    if (error) {
      console.error(error)
      return null
    }
    return data
  },
  create: async ({ name, token }) => {
    const { data, error } = await supabase
      .from('hosts')
      .insert([
        { name, token }
      ])
    if (error) {
      console.error(error)
      return null
    }
    return data[0]
  }
}