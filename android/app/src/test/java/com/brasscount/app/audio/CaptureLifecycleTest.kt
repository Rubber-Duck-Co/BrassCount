package com.brasscount.app.audio

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CaptureLifecycleTest {
  // --- CaptureTeardown ---

  @Test
  fun `begin returns before the teardown has finished`() {
    val release = CountDownLatch(1)
    val finished = AtomicBoolean(false)
    val pool = Executors.newSingleThreadExecutor()
    try {
      val teardown = CaptureTeardown(pool)

      teardown.begin {
        release.await(5, TimeUnit.SECONDS)
        finished.set(true)
      }

      assertFalse(finished.get())
      release.countDown()
      assertTrue(teardown.awaitIdle(5_000))
      assertTrue(finished.get())
    } finally {
      pool.shutdownNow()
    }
  }

  @Test
  fun `awaitIdle waits for a teardown still running`() {
    val release = CountDownLatch(1)
    val pool = Executors.newSingleThreadExecutor()
    try {
      val teardown = CaptureTeardown(pool)
      teardown.begin { release.await(5, TimeUnit.SECONDS) }

      assertFalse(teardown.awaitIdle(50))
      release.countDown()
      assertTrue(teardown.awaitIdle(5_000))
    } finally {
      pool.shutdownNow()
    }
  }

  @Test
  fun `awaitIdle returns at once when nothing is tearing down`() {
    val teardown = CaptureTeardown(Executor { it.run() })

    assertTrue(teardown.awaitIdle(0))
  }

  @Test
  fun `a restart waits so only one recorder is ever open`() {
    val open = AtomicOpenCount()
    val release = CountDownLatch(1)
    val pool = Executors.newSingleThreadExecutor()
    try {
      val teardown = CaptureTeardown(pool)
      open.opened() // the recorder being stopped
      teardown.begin {
        release.await(5, TimeUnit.SECONDS)
        open.released()
      }

      // start(): waits for the old recorder, and only then opens a new one.
      assertFalse(teardown.awaitIdle(50))
      release.countDown()
      assertTrue(teardown.awaitIdle(5_000))
      open.opened()

      assertEquals(1, open.maxLive)
    } finally {
      pool.shutdownNow()
    }
  }

  @Test
  fun `awaitIdle waits for every teardown begun, not just the first`() {
    val releaseFirst = CountDownLatch(1)
    val releaseSecond = CountDownLatch(1)
    val pool = Executors.newSingleThreadExecutor()
    try {
      val teardown = CaptureTeardown(pool)
      teardown.begin { releaseFirst.await(5, TimeUnit.SECONDS) }
      teardown.begin { releaseSecond.await(5, TimeUnit.SECONDS) }

      releaseFirst.countDown()
      assertFalse(teardown.awaitIdle(50))
      releaseSecond.countDown()
      assertTrue(teardown.awaitIdle(5_000))
    } finally {
      pool.shutdownNow()
    }
  }

  @Test
  fun `a teardown begun while another waits for idle is waited for too`() {
    val release = CountDownLatch(1)
    val pool = Executors.newSingleThreadExecutor()
    try {
      val teardown = CaptureTeardown(pool)
      // Begun before the wait starts, as stopInternal does under its lock.
      teardown.begin { release.await(5, TimeUnit.SECONDS) }

      assertFalse(teardown.awaitIdle(20))
    } finally {
      release.countDown()
      pool.shutdownNow()
    }
  }

  @Test
  fun `a teardown that throws still lets a waiting start continue`() {
    val teardown = CaptureTeardown(Executor { runCatching { it.run() } })

    teardown.begin { error("release failed") }

    assertTrue(teardown.awaitIdle(1_000))
  }

  @Test
  fun `a refused teardown is not waited for`() {
    val teardown = CaptureTeardown(Executor { throw RejectedExecutionException() })

    runCatching { teardown.begin {} }

    assertTrue(teardown.awaitIdle(0))
  }

  // --- openFirstSource ---

  @Test
  fun `the first source that opens and records wins`() {
    val tried = mutableListOf<String>()

    val outcome =
      openFirstSource(listOf("a", "b"), { tried += it; it }, { it })

    assertEquals(OpenOutcome.Opened("a"), outcome)
    assertEquals(listOf("a"), tried)
  }

  @Test
  fun `a source that will not open falls back to the next`() {
    val outcome =
      openFirstSource(listOf("a", "b"), { if (it == "a") null else it }, { it })

    assertEquals(OpenOutcome.Opened("b"), outcome)
  }

  @Test
  fun `a source that opens but will not record falls back to the next`() {
    val outcome =
      openFirstSource(listOf("a", "b"), { it }, { if (it == "a") null else it })

    assertEquals(OpenOutcome.Opened("b"), outcome)
  }

  @Test
  fun `no source opening is an init failure`() {
    val outcome = openFirstSource(listOf("a", "b"), { null as String? }, { it })

    assertEquals(OpenOutcome.InitFailed, outcome)
  }

  @Test
  fun `a source opening but none recording is a start failure`() {
    val outcome = openFirstSource(listOf("a", "b"), { it }, { null as String? })

    assertEquals(OpenOutcome.StartFailed, outcome)
  }

  @Test
  fun `an empty source list is an init failure`() {
    val outcome = openFirstSource(emptyList<String>(), { it }, { it })

    assertEquals(OpenOutcome.InitFailed, outcome)
  }

  private class AtomicOpenCount {
    private var live = 0
    var maxLive = 0
      private set

    @Synchronized
    fun opened() {
      live++
      maxLive = maxOf(maxLive, live)
    }

    @Synchronized
    fun released() {
      live--
    }
  }
}
