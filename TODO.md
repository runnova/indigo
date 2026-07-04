# Known Bugs
- bot slash commands have not been implemented yet.
- virt scrolling is bad. scrolling back down doesnt load newer messages. (3.2)
- CORS. it needs to be able to proxy attatchments (5.1.4)

# To Do
1. **Big stuff**
   1. **Server settings/admin**
   2. **Threads**
      1. **Thread interactions**
         Requires: 1.2
         Related: 11.2

2. **Context menu**
   1. **Server sidebar**
      1. Reload server icon
      2. Reset server cache
      3. **Cohesive DMs** server icon
         Requires: 5.1.1, 13.1
   2. **User**
      1. Block user
         Related: 5.1.8

3. **Virtual scrolling**
   1. Improve virtualization
   2. Downward virtual scrolling
      Requires: 3.1

4. **User popup**
   1. **Direct message** from input
      Requires: 5.1.1
   2. **Single source of truth** for user data
      Related: 7.1, 10.2

5. **Settings**
   1. **General**
      1. **Set direct message server**
         Related: 2.1.3, 4.1, 13.1
      2. **Profile overlays** toggle
      3. **Send typing** toggle
         Related: 6.3
      4. **Media proxy** server setting
      5. **Idle connection** types
      6. **Load attachment** methods
      7. **Show nicknames** methods
         Related: 7.2
      8. **Messages from blocked users**
         Related: 2.2.1
      9. **Owner crown** toggle
         Related: 7.2
      10. **Edited label** toggle
         Related: 10.1

   2. **Themes**
      1. **Color theme generation**

   3. **Code plugins**
      1. **Plugin events**
         Related: 12.1, 12.2, 6.3

6. **Message compose box**
   1. **Stickers** and sticker search
   2. Show emojis from all connected servers
   3. Stop typing on message receive
      Related: 5.1.3
   4. Send gift

7. **User list**
   1. **Real-time status** updates
      Requires: 11.1
      Related: 4.2
   2. **Owner crown**
      Related: 5.1.7, 5.1.9

8. **Media preview dialog**
   1. Close on Esc/backdrop click
   2. Prevent tall attachments overflowing screen

9. **General UI**
   1. **Fixed column widths**
   2. **Resizable columns**
      Requires: 9.1
   3. **Persist column widths**
      Requires: 9.2

10. **Individual messages**
    1. **Edited label**
       Related: 5.1.10
    2. Clicking mentions opens **user popup**
       Requires: 4.2

11. **WebSocket event types**
    1. **Status updates**
       Related: 7.1
    2. **Thread events**
       Related: 1.2

12. **Message actions**
    1. **Add reactions**
    2. Quote

13. **Spotlight search**
    1. Search **servers, channels, and DM server users**
       Requires: 5.1.1
       Related: 2.1.3