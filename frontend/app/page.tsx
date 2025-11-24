'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/userlogin')
  }, [])

  return (
    <div>
      <h1>FluxPlanner - Homework Tracker for Students</h1>
      <p>Never forget your homework again</p>
      
      <nav>
        <a href="/keep-forgetting-homework-solution">Keep Forgetting Homework Solution</a>
        <a href="/homework-organizer-chromebook-students">Homework Organizer for Chromebook Students</a>
        <a href="/notion-alternative-for-homework">Notion Alternative for Homework</a>
        <a href="/track-homework-multiple-classes">Track Homework Multiple Classes</a>
        <a href="/stop-procrastinating-homework-tracker">Stop Procrastinating Homework Tracker</a>
        <a href="/track-assignments-improve-grades">Track Assignments Improve Grades</a>
        <a href="/homework-planner-busy-high-school-students">Homework Planner for Busy High School Students</a>
        <a href="/digital-homework-planner-high-school">Digital Homework Planner High School</a>
        <a href="/see-homework-due-this-week">See Homework Due This Week</a>
        <a href="/adhd-homework-tracker-high-school">ADHD Homework Tracker High School</a>
        <a href="/homework-tracker-student-athletes">Homework Tracker for Student Athletes</a>
        <a href="/confused-about-homework-assignments">Confused About Homework Assignments</a>
        <a href="/actually-productive-study-hall-homework">Actually Productive Study Hall Homework</a>
        <a href="/homework-tracker-stop-parent-nagging">Homework Tracker Stop Parent Nagging</a>
      </nav>
      
      <a href="/userlogin">Sign In</a>
    </div>
  )
}