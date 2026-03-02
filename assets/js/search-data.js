// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-publications",
          title: "publications",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-projects",
          title: "projects",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "nav-experience",
          title: "experience",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/experience/";
          },
        },{id: "news-joined-nus-advanced-control-lab-started-master-s-program-at-nus",
          title: 'Joined NUS Advanced Control Lab, started Master’s program at NUS.',
          description: "",
          section: "News",},{id: "news-completed-robotics-software-internship-at-movel-ai-dec-2025-jan-2026-working-on-autonomous-forklift-navigation",
          title: 'Completed robotics software internship at Movel.AI (Dec 2025 – Jan 2026), working on...',
          description: "",
          section: "News",},{id: "projects-vla-language-understanding-benchmark",
          title: 'VLA Language Understanding Benchmark',
          description: "Designed a systematic semantic perturbation evaluation framework revealing that state-of-the-art VLA models ignore language instructions despite high benchmark scores. Proposed multi-task same-scene training approach and constructed augmented dataset for fine-tuning.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/1_vla_benchmark/";
            },},{id: "projects-aion-aerial-indoor-object-goal-navigation",
          title: 'AION: Aerial Indoor Object-Goal Navigation',
          description: "End-to-end dual-policy RL framework for vision-based aerial ObjectNav without external localization or global maps. Evaluated on AI2-THOR and IsaacSim.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/2_objectnav_drone/";
            },},{id: "projects-vision-language-navigation-on-autonomous-drone",
          title: 'Vision-Language Navigation on Autonomous Drone',
          description: "Built a robust pipeline to generate various 3D paths in the Habitat simulator. Overcame challenges of the simulator initially designed only for ground robots by designing a robust 3D navigation algorithm and obstacle detection method. Trained a strong and general policy for drone navigation.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/3_vln_drone/";
            },},{id: "projects-frontier-based-autonomous-exploration-vehicle",
          title: 'Frontier-Based Autonomous Exploration Vehicle',
          description: "Led a team to develop an autonomous exploration system using ROS2 and LiDAR. Implemented SLAM algorithms including Cartographer and Navigation2 for real-time mapping and path planning. Integrated YOLOv11 for object detection and deployed the complete system on embedded hardware.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/4_exploration_vehicle/";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%79%75%63%68%65%6E%68%6F%75%32%38%37@%6F%75%74%6C%6F%6F%6B.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/YC11Hou", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/yuchen-hou-115025355", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
