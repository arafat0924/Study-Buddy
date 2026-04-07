import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Shuffle, GraduationCap, AlertCircle, Crown, Plus, Trash2, Play, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

type MemberInput = {
  id: string;
  name: string;
};

type GroupInput = {
  id: string;
  leader: string;
  members: MemberInput[];
};

type GroupData = {
  id: string;
  originalIndex: number;
  leader: string;
  members: string[];
  grade: string;
};

function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export default function CourseGroupShuffle() {
  // Form State
  const [courseName, setCourseName] = useState('Intro To Systems Software');
  const [teacherName, setTeacherName] = useState('Yanru Chen');
  const [presentationTitle, setPresentationTitle] = useState('AIGC Director Plan–Conceptual Short Film Challenge');

  const [groupInputs, setGroupInputs] = useState<GroupInput[]>([
    { id: 'g-1', leader: '', members: [{ id: 'm-1-1', name: '' }] }
  ]);

  // App State
  const [isGenerated, setIsGenerated] = useState(false);
  const [presentationGroups, setPresentationGroups] = useState<GroupData[]>([]);
  const [lastShuffle, setLastShuffle] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [lastAddedMemberId, setLastAddedMemberId] = useState<string | null>(null);

  const addGroup = () => {
    setGroupInputs([
      ...groupInputs,
      { id: `g-${Date.now()}`, leader: '', members: [{ id: `m-${Date.now()}`, name: '' }] }
    ]);
  };

  const removeGroup = (id: string) => {
    setGroupInputs(groupInputs.filter(g => g.id !== id));
  };

  const updateGroupLeader = (id: string, leader: string) => {
    setGroupInputs(groupInputs.map(g => g.id === id ? { ...g, leader } : g));
  };

  const addMember = (groupId: string) => {
    const newMemberId = `m-${Date.now()}`;
    setGroupInputs(groupInputs.map(g =>
      g.id === groupId ? { ...g, members: [...g.members, { id: newMemberId, name: '' }] } : g
    ));
    setLastAddedMemberId(newMemberId);
  };

  const updateMember = (groupId: string, memberId: string, name: string) => {
    setGroupInputs(groupInputs.map(g =>
      g.id === groupId ? {
        ...g,
        members: g.members.map(m => m.id === memberId ? { ...m, name } : m)
      } : g
    ));
  };

  const removeMember = (groupId: string, memberId: string) => {
    setGroupInputs(groupInputs.map(g =>
      g.id === groupId ? {
        ...g,
        members: g.members.filter(m => m.id !== memberId)
      } : g
    ));
  };

  const handleGenerate = () => {
    setError('');
    const validGroups: GroupData[] = [];

    for (let i = 0; i < groupInputs.length; i++) {
      const g = groupInputs[i];
      const leaderName = g.leader.trim();
      const memberNames = g.members.map(m => m.name.trim()).filter(Boolean);

      if (!leaderName && memberNames.length === 0) {
        continue; // Skip empty groups
      }

      let finalLeader = leaderName;
      let finalMembers = memberNames;

      // If no leader is specified but there are members, the first member becomes the leader
      if (!finalLeader && finalMembers.length > 0) {
        finalLeader = finalMembers[0];
        finalMembers = finalMembers.slice(1);
      }

      validGroups.push({
        id: g.id,
        originalIndex: i + 1,
        leader: finalLeader,
        members: finalMembers,
        grade: ''
      });
    }

    if (validGroups.length === 0) {
      setError('Please add at least one valid group with a leader or members.');
      return;
    }

    setPresentationGroups(validGroups);
    setIsGenerated(true);
    setLastShuffle(null);
  };

  const handleShuffle = () => {
    if (presentationGroups.length === 0) return;
    setPresentationGroups(shuffleArray(presentationGroups));
    setLastShuffle(new Date());
  };

  const updateGrade = (groupId: string, grade: string) => {
    setPresentationGroups(presentationGroups.map(g => g.id === groupId ? { ...g, grade } : g));
  };

  const handleExportExcel = () => {
    const tableData: any[] = [];

    // Header Info
    tableData.push(['COURSE DETAILS']);
    tableData.push(['Course Name:', courseName]);
    tableData.push(['Presentation Title:', presentationTitle]);
    tableData.push(['Teacher:', teacherName]);
    tableData.push(['Exported Date:', new Date().toLocaleDateString()]);
    tableData.push([]); // Empty spacing row

    // Table Headers
    tableData.push(['Group Number', 'Group Members', 'Presentation Order']);

    presentationGroups.forEach((g, index) => {
      // Combine leader and members into one string with newlines
      const allMembers = [g.leader, ...g.members].join('\n');

      tableData.push([
        { v: `Group ${g.originalIndex}`, s: { alignment: { vertical: 'center' } } },
        { v: allMembers, s: { alignment: { wrapText: true, vertical: 'top' } } },
        { v: index + 1, s: { alignment: { horizontal: 'center', vertical: 'center' } } }
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(tableData);

    // Apply header styles separately if needed, but aoa_to_sheet with objects works
    // Let's refine the worksheet creation to ensure styles are preserved

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Group Number
      { wch: 40 }, // Group Members
      { wch: 20 }  // Presentation Order
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Presentation Order");

    XLSX.writeFile(workbook, `${courseName.replace(/\s+/g, '_')}_Presentation_Order.xlsx`);
  };

  return (
    <div className="w-full flex-1 flex flex-col relative">
      <div className="relative z-[2] flex flex-col flex-1">
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          {!isGenerated ? (
            <div className="relative max-w-3xl mx-auto space-y-8">
              <div className="relative bg-[#11235a]/85 p-6 rounded-xl shadow-lg border border-[#1a2a5c] backdrop-blur-sm transition-transform hover:scale-[1.01]">
                <h2 className="text-xl font-bold text-blue-100 mb-6 flex items-center gap-2">
                  <GraduationCap size={24} className="text-blue-300" />
                  Course Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-blue-200 mb-1">Course Name</label>
                    <input
                      type="text"
                      required
                      value={courseName}
                      onChange={e => setCourseName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#22306a] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-[#0a174e] text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-1">Teacher Name</label>
                    <input
                      type="text"
                      required
                      value={teacherName}
                      onChange={e => setTeacherName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#22306a] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-[#0a174e] text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-blue-200 mb-1">Presentation Title</label>
                    <input
                      type="text"
                      required
                      value={presentationTitle}
                      onChange={e => setPresentationTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-[#22306a] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-[#0a174e] text-white"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center">
                  <h2 className="text-xl font-bold text-blue-100 flex items-center gap-2">
                    <Users size={24} className="text-blue-300" />
                    Define Groups
                  </h2>
                </div>
                <div className="space-y-6">
                  <AnimatePresence>
                    {groupInputs.map((group, index) => (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={group.id}
                      >
                        <div className="bg-[#11235a]/85 p-5 rounded-xl shadow-lg border border-[#1a2a5c] relative backdrop-blur-sm transition-transform hover:scale-[1.01]">
                          {groupInputs.length > 1 && (
                            <button
                              onClick={() => removeGroup(group.id)}
                              className="absolute top-4 right-4 text-blue-300 hover:text-red-400 transition-colors"
                              title="Remove Group"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                          <h3 className="font-bold text-blue-100 mb-4">Group {index + 1}</h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-blue-200 mb-1 flex items-center gap-1">
                                <Crown size={14} className="text-yellow-500" /> Leader Name
                              </label>
                              <input
                                type="text"
                                value={group.leader}
                                onChange={e => updateGroupLeader(group.id, e.target.value)}
                                placeholder="Enter leader name (or leave blank to use first member)"
                                className="w-full px-3 py-2 border border-[#22306a] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-[#0a174e] text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-blue-200 mb-2">Members</label>
                              <div className="space-y-2">
                                <AnimatePresence>
                                  {group.members.map((member, mIndex) => (
                                    <motion.div
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      exit={{ opacity: 0, height: 0 }}
                                      key={member.id}
                                      className="flex items-center gap-2"
                                    >
                                      <span className="text-blue-300 text-sm w-5 text-right">{mIndex + 1}.</span>
                                      <input
                                        ref={(el) => {
                                          if (el && member.id === lastAddedMemberId) {
                                            el.focus();
                                            setLastAddedMemberId(null);
                                          }
                                        }}
                                        type="text"
                                        value={member.name}
                                        onChange={e => updateMember(group.id, member.id, e.target.value)}
                                        placeholder="Enter member name"
                                        className="flex-1 px-3 py-1.5 border border-[#22306a] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm bg-[#0a174e] text-white"
                                      />
                                      <button
                                        onClick={() => removeMember(group.id, member.id)}
                                        className="text-blue-300 hover:text-red-400 p-1 transition-colors"
                                        disabled={group.members.length === 1 && !group.leader}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </motion.div>
                                  ))}
                                </AnimatePresence>
                              </div>
                              <button
                                onClick={() => addMember(group.id)}
                                className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-200 hover:text-blue-100 transition-colors"
                              >
                                <Plus size={14} /> Add another member
                              </button>
                            </div>
                          </div>
                        </div>
                        {index === groupInputs.length - 1 && (
                          <div className="flex justify-end mt-4">
                            <button
                              onClick={addGroup}
                              className="flex items-center gap-1 text-sm font-medium text-blue-100 hover:text-white bg-[#1a2a5c]/80 hover:bg-[#22306a] px-4 py-2 rounded-lg transition-colors border border-[#22306a]"
                            >
                              <Plus size={16} /> Add Group
                            </button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-900/80 text-red-200 text-sm rounded-xl flex items-start gap-2 border border-red-800 backdrop-blur-sm"
                  >
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}
                <div className="pt-4">
                  <button
                    onClick={handleGenerate}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-xl font-bold text-lg hover:from-blue-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <Play size={20} />
                    Start Presentations
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Toolbar */}
              <div className="bg-[#11235a]/85 p-4 rounded-xl shadow-lg border border-[#1a2a5c] flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden backdrop-blur-sm">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setIsGenerated(false)}
                    className="flex items-center justify-center gap-2 bg-[#1a2a5c]/60 text-blue-100 px-4 py-2.5 rounded-lg font-medium hover:bg-[#22306a] transition-colors border border-[#22306a]"
                  >
                    <ArrowLeft size={18} />
                    Edit Groups
                  </button>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-center">
                  <button
                    onClick={handleShuffle}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <Shuffle size={18} />
                    Shuffle Presentation Order
                  </button>
                  {lastShuffle && (
                    <span className="text-xs text-blue-200 hidden md:block">
                      Last shuffled: {lastShuffle.toLocaleTimeString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleExportExcel}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#1a2a5c]/60 text-blue-100 border border-[#22306a] px-4 py-2.5 rounded-lg font-medium hover:bg-[#22306a] transition-colors shadow-sm"
                  >
                    <FileSpreadsheet size={18} />
                    Export Excel
                  </button>
                </div>
              </div>

              {/* Groups Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-6">
                <AnimatePresence>
                  {presentationGroups.map((group, index) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.8, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.5, type: "spring", bounce: 0.3 }}
                      key={group.id}
                      className="bg-[#11235a]/85 rounded-xl shadow-lg border border-[#1a2a5c] overflow-hidden print:border-gray-400 print:shadow-none print:break-inside-avoid flex flex-col backdrop-blur-sm hover:border-blue-500/50 transition-colors"
                    >
                      <div className="bg-[#0a174e]/60 px-4 py-3 border-b border-[#1a2a5c] flex justify-between items-center print:bg-transparent print:border-b-2 print:border-gray-800">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm print:border print:border-gray-400 print:bg-transparent print:text-black shadow-inner">
                            {index + 1}
                          </span>
                          <h3 className="font-bold text-lg text-blue-100 print:text-black">Group {group.originalIndex}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-blue-200 print:hidden">Grade:</span>
                          <input
                            type="text"
                            value={group.grade}
                            onChange={(e) => updateGrade(group.id, e.target.value)}
                            placeholder="---"
                            className="w-16 px-2 py-1 text-sm border border-[#22306a] rounded text-center focus:ring-2 focus:ring-blue-500 outline-none print:border-none print:p-0 print:w-auto print:text-black font-semibold bg-[#0a174e] text-blue-100"
                          />
                        </div>
                      </div>
                      <div className="p-4 flex-1">
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2 text-blue-100 font-medium bg-[#1a2a5c]/60 px-3 py-2 rounded-lg print:bg-transparent print:px-0 print:py-1 print:text-black border border-[#22306a]/50">
                            <Crown size={16} className="text-yellow-400 shrink-0" />
                            <span className="truncate">{group.leader}</span>
                            <span className="text-[10px] text-blue-300 uppercase tracking-wider ml-auto print:hidden font-bold shrink-0">Leader</span>
                          </li>
                          {group.members.map((member, mIdx) => (
                            <li
                              key={mIdx}
                              className="flex items-center gap-2 text-blue-200 px-3 py-1.5 print:px-0 print:py-1 print:text-black hover:bg-[#1a2a5c]/30 rounded-lg transition-colors"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 print:hidden"></div>
                              <span className="truncate">{member}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </main>
        <footer className="mt-auto py-8 border-t border-[#1a2a5c] text-center text-blue-200 print:hidden bg-[#030821]/85 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4">
            <p className="mb-3 text-sm">
              Developed by Md. Arafat Hosen (赞欣)
            </p>

          </div>
        </footer>
      </div>
    </div>
  );
}
