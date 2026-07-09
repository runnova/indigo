# Known Bugs
- bot slash commands have not been implemented yet.
- virt scrolling is bad. scrolling back down doesnt load newer messages. (3.2)
- CORS. it needs to be able to proxy attatchments (5.1.4)

# To Do
1. thread interactions
   - create, send message & more.
2. context menu
   1. server bar
      - reload icon
      - reset cache
      - better dms server icon
   2. user
      - block user
      - add/remove friend
3. message list
   1. individual message
      - edited label
      - clicking mentions opens user popup
   2. actions
      - quote message
   3. virtual scrolling
      - downward virtual scrolling
4. user list
   1. real time status (8.1)
5. user popup
   1. dms from input
   2. single source of truth for data
6. settings
   1. general
      - toggles
         - profile overlays
         - send typing
         - owner crown
         - edited messages
      - methods
         - idle connection
         - load attachment
         - show nicknames
         - blocked user messages
   2. themes
      - color theme generation
      - background wallpaper setting
   3. JS plugins
7. message compose box
   1. emoji picker
      - sticker search
      - show custom emojis from all connected servers
   2. stop displaying typing on message receive
   3. send gifts 
8. websocket connection
   1. events
      - status
      - thread
9. spotlight search
   1. search servers, channels, DM users
10. DMs server
   2. ui functionality instead of bot