import {
  HiOutlineArrowTopRightOnSquare,
  HiOutlineTrash,
  HiOutlineArrowPath,
  HiOutlineArrowUturnLeft,
  HiOutlineClipboard,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCommandLine,
  HiOutlineDocumentText,
  HiOutlineChatBubbleBottomCenterText
} from "solid-icons/hi";
import SystemContextMenu from '../components/Systemcontextmenu.js';
import { setState } from "../App.jsx";

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
        label: 'Reset cache',
        icon: HiOutlineArrowPath,
        fn: (el) => console.log('reset cache', el),
      },
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
            label: 'Copy text',
            icon: HiOutlineDocumentText,
            fn: (el) => console.log('copy text', el),
          },
          {
            label: 'Quote',
            icon: HiOutlineChatBubbleBottomCenterText,
            fn: (el) => console.log('quote', el),
          },
        ],
      },
    ],
  },
]);