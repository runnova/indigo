import {
  HiOutlineArrowTopRightOnSquare,
  HiOutlineTrash,
  HiOutlineArrowPath,
  HiOutlineArrowUturnLeft,
  HiOutlineClipboard,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCommandLine,
  HiOutlineDocumentText,
  HiOutlineChatBubbleBottomCenterText,
  HiOutlineMapPin,
  HiOutlineXMark
} from "solid-icons/hi";
import SystemContextMenu from '../components/Systemcontextmenu.js';
import { setState } from "../App.jsx";
import { getMessageById, addFakeMessage } from "../scrolling.jsx"
import { reconnectServer } from "./server_connection.jsx";
import { generateQuoteImage, canvasToBlob } from '../components/utility/quote-maker.js';
import { addAttachment } from '../components/compose/MessageComposer.jsx';

const removeServer = (src) => {
  setState("servers", servers =>
    servers.filter(server => server.src !== src)
  );
};

SystemContextMenu.init([
  {
    'data-context': 'server',
    actions: [
      {
        label: 'Open',
        icon: HiOutlineArrowTopRightOnSquare,
        fn: (el) => el.click(),
      },
      {
        label: 'Remove',
        icon: HiOutlineTrash,
        fn: (el) => {
          removeServer(el.dataset.src)
        },
      },
      {
        label: 'Reload icon',
        icon: HiOutlineArrowPath,
        fn: (el) => {
          const img = el.closest('.server_icon');
          if (!img) return;

          const url = new URL(img.src);
          url.searchParams.set('_', Date.now());

          img.src = url.toString();
        },
      },
      {
        label: 'Reconnect',
        icon: HiOutlineArrowPath,
        fn: (el) => reconnectServer(el.dataset.src),
      },
    ],
  },
  {
    'data-context': 'type_chat',
    actions: [
      {
        label: 'Pin DM',
        icon: HiOutlineMapPin,
        fn: (el) => {
          console.log(el.dataset.name)
        },
      },
      {
        label: 'Remove',
        icon: HiOutlineTrash,
        fn: (el) => {
          // 
        },
      }
    ],
  },
  {
    'data-context': 'dm_pinned',
    actions: [
      {
        label: 'Unpin DM',
        icon: HiOutlineXMark,
        fn: (el) => {
          // 
        },
      }
    ],
  },
  {
    'data-context': 'message',
    actions: [
      {
        label: 'Reply',
        icon: HiOutlineArrowUturnLeft,
        fn: (el) => {
          const msg = getMessageById(el.dataset.id);
          console.log(el.dataset.id, msg)
          setState("replying", {
            id: el.dataset.id,
            user: msg.user,
            content: msg.content,
          });
        },
      },
      {
        label: 'Copy ID',
        icon: HiOutlineClipboard,
        fn: (el) => console.log(el.dataset.id),
      },
      {
        label: 'Message Actions',
        icon: HiOutlineChatBubbleLeftRight,
        actions: [
          {
            label: 'Packet inspect',
            icon: HiOutlineCommandLine,
            fn: (el) => {
              const msg = getMessageById(el.dataset.id);
              console.log(el.dataset.id, msg)
              addFakeMessage({
                user: "Indigo",
                avatar: "/icon_small.svg",
                content: `\`\`\`json
                ${JSON.stringify(msg, null, 2)}
                \`\`\``,
              });
            },
          },
          {
            label: 'Quote message',
            icon: HiOutlineChatBubbleBottomCenterText,
            fn: async (el) => {
              const msg = getMessageById(el.dataset.id);
              if (!msg) return;

              try {
                const canvas = await generateQuoteImage({
                  pfpUrl: `https://proxy.corsfix.com/?https://avatars.rotur.dev/${msg.user}`,
                  content: msg.content,
                  author: msg.user,
                  watermarkText: 'Indigo client',
                  watermarkIconUrl: '/icon_small.svg',
                });

                const blob = await canvasToBlob(canvas);
                const file = new File([blob], `quote-${msg.id}.png`, { type: 'image/png' });
                window.open(URL.createObjectURL(blob), "_blank")

                addAttachment(file);
              } catch (err) {
                console.error('Failed to generate quote image:', err);
              }
            },
          },
          {
            label: 'Copy text',
            icon: HiOutlineDocumentText,
            fn: (el) => console.log('copy text', el),
          },
        ],
      },
    ],
  },
]);